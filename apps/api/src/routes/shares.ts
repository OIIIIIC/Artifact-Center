import { randomBytes } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { applications, artifacts, shareLinks } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { requireMinRole } from '../middleware/require-role.js'

const createSchema = z.object({
  mode: z.enum(['latest', 'artifact']).default('latest'),
  artifactId: z.string().uuid().optional(),
  /** 0 or omit = never expires */
  expiresInDays: z.number().int().min(0).max(365).optional(),
})

function mapShare(row: typeof shareLinks.$inferSelect) {
  return {
    id: row.id,
    token: row.token,
    applicationId: row.applicationId,
    mode: row.mode,
    artifactId: row.artifactId,
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

export const shareRoutes = new Hono<{ Variables: AuthVariables }>()

/** POST /applications/:appId/shares */
shareRoutes.post(
  '/applications/:appId/shares',
  requireAuth,
  requireMinRole('maintainer'),
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
      .select({ id: applications.id, name: applications.name })
      .from(applications)
      .where(eq(applications.id, appId))
      .limit(1)
    if (!app) return jsonError(c, 404, 'not_found', 'Application not found')

    const mode = parsed.data.mode
    let artifactId: string | null = null

    if (mode === 'artifact') {
      if (!parsed.data.artifactId) {
        return jsonError(c, 400, 'invalid_body', 'artifactId required for pinned share')
      }
      const [art] = await db
        .select({ id: artifacts.id, applicationId: artifacts.applicationId })
        .from(artifacts)
        .where(eq(artifacts.id, parsed.data.artifactId))
        .limit(1)
      if (!art || art.applicationId !== appId) {
        return jsonError(c, 404, 'not_found', 'Artifact not found for this application')
      }
      artifactId = art.id
    }

    const days = parsed.data.expiresInDays ?? 0
    const expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null

    const token = newToken()
    const [row] = await db
      .insert(shareLinks)
      .values({
        token,
        applicationId: appId,
        mode,
        artifactId,
        createdById: user.sub,
        createdByName: user.name || user.email,
        expiresAt,
      })
      .returning()

    await writeAudit(c, {
      action: 'share.create',
      objectType: 'application',
      objectId: row.id,
      applicationId: appId,
      summary: `创建分享链接（${mode === 'latest' ? '始终最新' : '固定版本'}）· ${app.name}`,
      meta: { mode, artifactId, expiresAt: expiresAt?.toISOString() ?? null },
    })

    return c.json({ share: mapShare(row) }, 201)
  },
)

/** GET /applications/:appId/shares */
shareRoutes.get(
  '/applications/:appId/shares',
  requireAuth,
  requireMinRole('maintainer'),
  async (c) => {
    const appId = c.req.param('appId')
    const [app] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.id, appId))
      .limit(1)
    if (!app) return jsonError(c, 404, 'not_found', 'Application not found')

    const rows = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.applicationId, appId))
      .orderBy(desc(shareLinks.createdAt))
      .limit(100)

    return c.json({ items: rows.map(mapShare), total: rows.length })
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
    if (row.revokedAt) {
      return c.json({ share: mapShare(row) })
    }

    // Admin or creator can revoke
    if (user.role !== 'admin' && row.createdById && row.createdById !== user.sub) {
      return jsonError(c, 403, 'forbidden', 'Only creator or admin can revoke')
    }

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
      meta: { tokenPrefix: updated.token.slice(0, 8) },
    })

    return c.json({ share: mapShare(updated) })
  },
)
