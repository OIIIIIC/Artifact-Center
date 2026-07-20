import { randomBytes } from 'node:crypto'
import { desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { applications, artifacts, shareLinkItems, shareLinks } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import {
  hasApplicationRole,
  requireApplicationRole,
} from '../middleware/application-access.js'
import { requireMinRole } from '../middleware/require-role.js'

const itemSchema = z.object({
  applicationId: z.string().uuid(),
  mode: z.enum(['latest', 'artifact']).default('artifact'),
  artifactId: z.string().uuid().optional(),
})

const createSchema = z.object({
  mode: z.enum(['latest', 'artifact']).default('latest'),
  artifactId: z.string().uuid().optional(),
  /** 0 or omit = never expires */
  expiresInDays: z.number().int().min(0).max(365).optional(),
})

const createCollectionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    regionId: z.string().uuid(),
    items: z.array(itemSchema).min(1).max(20),
    expiresInDays: z.number().int().min(0).max(365).optional(),
  })
  .superRefine((value, ctx) => {
    const ids = value.items.map((item) => item.applicationId)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Duplicate application' })
    }
  })

function mapShare(
  row: typeof shareLinks.$inferSelect,
  itemCount = 1,
  item?: { mode: 'latest' | 'artifact'; artifactVersion: string | null },
) {
  return {
    id: row.id,
    token: row.token,
    kind: row.kind,
    title: row.title,
    regionId: row.regionId,
    applicationId: row.applicationId,
    mode: row.mode,
    artifactId: row.artifactId,
    itemMode: item?.mode ?? row.mode,
    artifactVersion: item?.artifactVersion ?? null,
    itemCount,
    createdBy: row.createdByName,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    downloadCount: row.downloadCount,
  }
}

function newToken(): string {
  return randomBytes(24).toString('base64url')
}

function expiryFromDays(days = 0) {
  return days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null
}

async function resolvePinnedArtifact(applicationId: string, artifactId?: string) {
  if (artifactId) {
    const [artifact] = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, artifactId))
      .limit(1)
    return artifact?.applicationId === applicationId ? artifact : undefined
  }

  const candidates = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.applicationId, applicationId))
    .orderBy(desc(artifacts.uploadedAt))
  return (
    candidates.find((artifact) => artifact.status === 'latest') ??
    candidates.find((artifact) => artifact.status !== 'archived') ??
    candidates[0]
  )
}

export const shareRoutes = new Hono<{ Variables: AuthVariables }>()

/** POST /shares — 创建同一地域的 Share Collection。 */
shareRoutes.post('/shares', requireAuth, requireMinRole('maintainer'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null)
  const parsed = createCollectionSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid share collection payload',
      parsed.error.flatten(),
    )
  }

  const applicationIds = parsed.data.items.map((item) => item.applicationId)
  const apps = await db
    .select()
    .from(applications)
    .where(inArray(applications.id, applicationIds))
  if (apps.length !== applicationIds.length) {
    return jsonError(c, 404, 'application_missing', 'Application not found')
  }
  if (apps.some((app) => app.regionId !== parsed.data.regionId)) {
    return jsonError(c, 400, 'mixed_regions', 'All applications must use one region')
  }
  if (apps.some((app) => app.status === 'archived')) {
    return jsonError(c, 409, 'archived_application', 'Application is archived')
  }
  for (const applicationId of applicationIds) {
    if (!(await hasApplicationRole(user, applicationId, 'maintainer'))) {
      return jsonError(c, 403, 'forbidden', 'Insufficient application role')
    }
  }

  const resolvedItems: Array<{
    applicationId: string
    mode: 'latest' | 'artifact'
    artifactId: string | null
    sortOrder: number
  }> = []
  for (const [sortOrder, item] of parsed.data.items.entries()) {
    let artifactId: string | null = null
    if (item.mode === 'artifact') {
      const artifact = await resolvePinnedArtifact(item.applicationId, item.artifactId)
      if (!artifact) {
        return jsonError(
          c,
          409,
          'artifact_missing',
          'No artifact is available for an application',
          { applicationId: item.applicationId },
        )
      }
      if (artifact.status === 'archived') {
        return jsonError(c, 409, 'archived_artifact', 'Artifact is archived')
      }
      artifactId = artifact.id
    }
    resolvedItems.push({
      applicationId: item.applicationId,
      mode: item.mode,
      artifactId,
      sortOrder,
    })
  }

  const appById = new Map(apps.map((app) => [app.id, app]))
  const orderedApps = applicationIds.map((id) => appById.get(id)!)
  const expiresAt = expiryFromDays(parsed.data.expiresInDays)
  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(shareLinks)
      .values({
        token: newToken(),
        kind: 'collection',
        title: parsed.data.title,
        regionId: parsed.data.regionId,
        // 兼容旧列表字段；Share Collection 的真实成员以 share_link_items 为准。
        applicationId: orderedApps[0].id,
        mode: 'latest',
        artifactId: null,
        createdById: user.sub,
        createdByName: user.name || user.email,
        expiresAt,
      })
      .returning()
    await tx
      .insert(shareLinkItems)
      .values(resolvedItems.map((item) => ({ ...item, shareLinkId: created.id })))
    return created
  })

  await writeAudit(c, {
    action: 'share.create',
    objectType: 'application',
    objectId: row.id,
    applicationId: row.applicationId,
    summary: `创建分享清单 · ${row.title}（${resolvedItems.length} 项）`,
    meta: {
      kind: 'collection',
      regionId: row.regionId,
      applicationIds,
      itemCount: resolvedItems.length,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  })

  return c.json({ share: mapShare(row, resolvedItems.length) }, 201)
})

/** POST /applications/:appId/shares — 保留单应用分享接口。 */
shareRoutes.post(
  '/applications/:appId/shares',
  requireAuth,
  requireMinRole('maintainer'),
  requireApplicationRole('appId', 'maintainer'),
  async (c) => {
    const appId = c.req.param('appId')
    const user = c.get('user')
    const body = await c.req.json().catch(() => null)
    const parsed = createSchema.safeParse(body ?? {})
    if (!parsed.success) {
      return jsonError(
        c,
        400,
        'invalid_body',
        'Invalid share payload',
        parsed.error.flatten(),
      )
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appId))
      .limit(1)
    if (!app) return jsonError(c, 404, 'not_found', 'Application not found')
    if (app.status === 'archived') {
      return jsonError(c, 409, 'archived_application', 'Application is archived')
    }

    let artifactId: string | null = null
    if (parsed.data.mode === 'artifact') {
      if (!parsed.data.artifactId) {
        return jsonError(c, 400, 'invalid_body', 'artifactId required for pinned share')
      }
      const artifact = await resolvePinnedArtifact(appId, parsed.data.artifactId)
      if (!artifact) {
        return jsonError(c, 404, 'not_found', 'Artifact not found for this application')
      }
      if (artifact.status === 'archived') {
        return jsonError(
          c,
          409,
          'archived_artifact',
          'Archived artifacts cannot create pinned shares',
        )
      }
      artifactId = artifact.id
    }

    const expiresAt = expiryFromDays(parsed.data.expiresInDays)
    const row = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(shareLinks)
        .values({
          token: newToken(),
          kind: 'single',
          title: app.name,
          regionId: app.regionId,
          applicationId: appId,
          mode: parsed.data.mode,
          artifactId,
          createdById: user.sub,
          createdByName: user.name || user.email,
          expiresAt,
        })
        .returning()
      await tx.insert(shareLinkItems).values({
        shareLinkId: created.id,
        applicationId: appId,
        mode: parsed.data.mode,
        artifactId,
      })
      return created
    })

    await writeAudit(c, {
      action: 'share.create',
      objectType: 'application',
      objectId: row.id,
      applicationId: appId,
      summary: `创建分享链接（${parsed.data.mode === 'latest' ? '始终最新' : '固定版本'}）· ${app.name}`,
      meta: {
        mode: parsed.data.mode,
        artifactId,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
    })

    return c.json({ share: mapShare(row) }, 201)
  },
)

/** GET /applications/:appId/shares */
shareRoutes.get(
  '/applications/:appId/shares',
  requireAuth,
  requireMinRole('maintainer'),
  requireApplicationRole('appId', 'maintainer'),
  async (c) => {
    const appId = c.req.param('appId')
    const rows = await db
      .select({
        share: shareLinks,
        itemMode: shareLinkItems.mode,
        artifactVersion: artifacts.version,
      })
      .from(shareLinkItems)
      .innerJoin(shareLinks, eq(shareLinkItems.shareLinkId, shareLinks.id))
      .leftJoin(artifacts, eq(shareLinkItems.artifactId, artifacts.id))
      .where(eq(shareLinkItems.applicationId, appId))
      .orderBy(desc(shareLinks.createdAt))
      .limit(100)

    const unique = [...new Map(rows.map((row) => [row.share.id, row])).values()]
    const counts = await Promise.all(
      unique.map(async ({ share, itemMode, artifactVersion }) => {
        const items = await db
          .select({ id: shareLinkItems.id })
          .from(shareLinkItems)
          .where(eq(shareLinkItems.shareLinkId, share.id))
        return mapShare(share, items.length, { mode: itemMode, artifactVersion })
      }),
    )
    return c.json({ items: counts, total: counts.length })
  },
)

/** DELETE /shares/:id — revoke */
shareRoutes.delete(
  '/shares/:id',
  requireAuth,
  requireMinRole('maintainer'),
  async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')
    const [row] = await db.select().from(shareLinks).where(eq(shareLinks.id, id)).limit(1)
    if (!row) return jsonError(c, 404, 'not_found', 'Share not found')
    if (user.role !== 'admin' && row.createdById && row.createdById !== user.sub) {
      return jsonError(c, 403, 'forbidden', 'Only creator or admin can revoke')
    }
    if (
      user.role !== 'admin' &&
      !row.createdById &&
      !(await hasApplicationRole(user, row.applicationId, 'maintainer'))
    ) {
      return jsonError(c, 403, 'forbidden', 'Insufficient application role')
    }
    if (row.revokedAt) return c.json({ share: mapShare(row) })

    const [updated] = await db
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(eq(shareLinks.id, id))
      .returning()

    await writeAudit(c, {
      action: 'share.revoke',
      objectType: 'application',
      objectId: updated.id,
      applicationId: updated.applicationId,
      summary: `吊销分享链接`,
      meta: { tokenPrefix: updated.token.slice(0, 8), kind: updated.kind },
    })
    return c.json({ share: mapShare(updated) })
  },
)
