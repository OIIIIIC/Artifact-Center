import { and, asc, desc, eq, ilike, isNull, ne, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import {
  applicationMembers,
  applications,
  artifacts,
  releases,
  users,
} from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { deleteStorageFile } from '../lib/storage.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { requireApplicationRole } from '../middleware/application-access.js'
import { requireMinRole, requireRoles } from '../middleware/require-role.js'

const platformEnum = z.enum(['android', 'windows', 'zip'])
const statusEnum = z.enum(['active', 'new', 'beta', 'deprecated', 'archived'])
const sortEnum = z.enum(['updated', 'name', 'created'])

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  packageName: z.string().min(1).max(255),
  platform: platformEnum,
  repository: z.string().max(500).optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(4000).optional(),
  packageName: z.string().min(1).max(255).optional(),
  platform: platformEnum.optional(),
  repository: z.string().max(500).optional(),
  status: statusEnum.optional(),
  ownerName: z.string().max(120).optional(),
})

function mapApp(row: typeof applications.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    packageName: row.packageName,
    platform: row.platform,
    repository: row.repository,
    status: row.status,
    owner: row.ownerName,
    latestVersion: row.latestVersion,
    artifactCount: row.artifactCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const applicationRoutes = new Hono<{ Variables: AuthVariables }>()

applicationRoutes.use('*', requireAuth)

applicationRoutes.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  const platform = c.req.query('platform') ?? 'all'
  const sort = sortEnum.safeParse(c.req.query('sort') ?? 'updated')
  const sortKey = sort.success ? sort.data : 'updated'

  const conditions = []
  if (q) {
    const pattern = `%${q}%`
    conditions.push(
      or(
        ilike(applications.name, pattern),
        ilike(applications.packageName, pattern),
        ilike(applications.ownerName, pattern),
      )!,
    )
  }
  if (platform !== 'all' && platformEnum.safeParse(platform).success) {
    conditions.push(eq(applications.platform, platform as 'android' | 'windows' | 'zip'))
  }

  const where = conditions.length ? and(...conditions) : undefined

  const order =
    sortKey === 'name'
      ? asc(applications.name)
      : sortKey === 'created'
        ? desc(applications.createdAt)
        : desc(applications.updatedAt)

  const user = c.get('user')
  const rows =
    user.role === 'admin'
      ? await db.select().from(applications).where(where).orderBy(order)
      : (
          await db
            .select({ application: applications })
            .from(applications)
            .innerJoin(
              applicationMembers,
              and(
                eq(applicationMembers.applicationId, applications.id),
                eq(applicationMembers.userId, user.sub),
              ),
            )
            .where(where)
            .orderBy(order)
        ).map((row) => row.application)

  return c.json({ items: rows.map(mapApp), total: rows.length })
})

applicationRoutes.get('/:id', requireApplicationRole('id', 'viewer'), async (c) => {
  const id = c.req.param('id')
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1)
  if (!row) return jsonError(c, 404, 'not_found', 'Application not found')
  return c.json({ application: mapApp(row) })
})

applicationRoutes.post('/', requireMinRole('maintainer'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid application payload',
      parsed.error.flatten(),
    )
  }

  const user = c.get('user')
  const data = parsed.data
  const packageName = data.packageName.trim()

  const [dup] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.packageName, packageName))
    .limit(1)
  if (dup) {
    return jsonError(c, 409, 'package_taken', 'Package name already in use')
  }

  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(applications)
      .values({
        name: data.name.trim(),
        description: data.description.trim(),
        packageName,
        platform: data.platform,
        repository: data.repository?.trim() || '',
        status: 'new',
        ownerId: user.sub,
        ownerName: user.name,
        latestVersion: '',
        artifactCount: 0,
      })
      .returning()

    await tx.insert(applicationMembers).values({
      applicationId: created.id,
      userId: user.sub,
      role: 'maintainer',
    })

    return created
  })

  await writeAudit(c, {
    action: 'app.create',
    objectType: 'application',
    objectId: row.id,
    applicationId: row.id,
    summary: `创建应用 ${row.name}`,
    meta: { packageName: row.packageName, platform: row.platform },
  })

  return c.json({ application: mapApp(row) }, 201)
})

applicationRoutes.patch(
  '/:id',
  requireMinRole('maintainer'),
  requireApplicationRole('id', 'maintainer'),
  async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(
        c,
        400,
        'invalid_body',
        'Invalid update payload',
        parsed.error.flatten(),
      )
    }

    const [current] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1)
    if (!current) return jsonError(c, 404, 'not_found', 'Application not found')

    const data = parsed.data
    if (data.packageName && data.packageName !== current.packageName) {
      const [dup] = await db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.packageName, data.packageName.trim()))
        .limit(1)
      if (dup) {
        return jsonError(c, 409, 'package_taken', 'Package name already in use')
      }
    }

    const [row] = await db
      .update(applications)
      .set({
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.packageName !== undefined
          ? { packageName: data.packageName.trim() }
          : {}),
        ...(data.platform !== undefined ? { platform: data.platform } : {}),
        ...(data.repository !== undefined ? { repository: data.repository.trim() } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.ownerName !== undefined ? { ownerName: data.ownerName.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning()

    await writeAudit(c, {
      action: 'app.update',
      objectType: 'application',
      objectId: row.id,
      applicationId: row.id,
      summary: `更新应用 ${row.name}`,
      meta: { fields: Object.keys(data) },
    })

    return c.json({ application: mapApp(row) })
  },
)

applicationRoutes.delete('/:id', requireRoles('admin'), async (c) => {
  const id = c.req.param('id')
  const [existing] = await db
    .select({ id: applications.id, name: applications.name })
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1)
  if (!existing) return jsonError(c, 404, 'not_found', 'Application not found')

  const files = await db
    .select({ storageKey: artifacts.storageKey })
    .from(artifacts)
    .where(eq(artifacts.applicationId, id))

  await db.delete(applications).where(eq(applications.id, id))
  await Promise.all(files.map((file) => deleteStorageFile(file.storageKey)))

  await writeAudit(c, {
    action: 'app.delete',
    objectType: 'application',
    objectId: existing.id,
    applicationId: null,
    summary: `删除应用 ${existing.name}`,
  })

  return c.json({ ok: true })
})

/** Nested: list artifacts for an application */
applicationRoutes.get(
  '/:id/artifacts',
  requireApplicationRole('id', 'viewer'),
  async (c) => {
    const id = c.req.param('id')
    const [app] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1)
    if (!app) return jsonError(c, 404, 'not_found', 'Application not found')

    const rows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.applicationId, id))
      .orderBy(desc(artifacts.uploadedAt))

    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        applicationId: r.applicationId,
        releaseId: r.releaseId,
        version: r.version,
        buildNumber: r.buildNumber,
        platform: r.platform,
        type: r.type,
        channel: r.channel,
        status: r.status,
        filename: r.filename,
        sizeBytes: r.sizeBytes,
        sha256: r.sha256,
        releaseNotes: r.releaseNotes,
        uploader: r.uploaderName,
        uploadedAt: r.uploadedAt.toISOString(),
        parsedMeta: r.parsedMeta,
        buildMeta: r.buildMeta,
      })),
    })
  },
)

/** 应用发布记录；一个 Release 可关联多个制品。 */
applicationRoutes.get(
  '/:id/releases',
  requireApplicationRole('id', 'viewer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const [releaseRows, artifactRows] = await Promise.all([
      db
        .select()
        .from(releases)
        .where(eq(releases.applicationId, applicationId))
        .orderBy(desc(releases.publishedAt)),
      db
        .select({ releaseId: artifacts.releaseId, type: artifacts.type })
        .from(artifacts)
        .where(eq(artifacts.applicationId, applicationId)),
    ])

    return c.json({
      items: releaseRows.map((release) => {
        const releaseArtifacts = artifactRows.filter(
          (artifact) => artifact.releaseId === release.id,
        )
        return {
          id: release.id,
          applicationId: release.applicationId,
          version: release.version,
          releaseNotes: release.releaseNotes,
          status: release.status,
          createdBy: release.createdByName,
          publishedAt: release.publishedAt.toISOString(),
          artifactCount: releaseArtifacts.length,
          artifactTypes: [...new Set(releaseArtifacts.map((artifact) => artifact.type))],
        }
      }),
      total: releaseRows.length,
    })
  },
)

/** 应用成员列表；成员可查看。 */
applicationRoutes.get(
  '/:id/members',
  requireApplicationRole('id', 'viewer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const [app] = await db
      .select({ ownerId: applications.ownerId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: applicationMembers.role,
        platformRole: users.role,
        joinedAt: applicationMembers.createdAt,
      })
      .from(applicationMembers)
      .innerJoin(users, eq(applicationMembers.userId, users.id))
      .where(eq(applicationMembers.applicationId, applicationId))
      .orderBy(asc(users.name))

    return c.json({
      items: rows.map((row) => ({
        ...row,
        isOwner: row.id === app?.ownerId,
        joinedAt: row.joinedAt.toISOString(),
      })),
      total: rows.length,
    })
  },
)

const memberRoleSchema = z.object({ role: z.enum(['maintainer', 'viewer']) })

/** 应用维护者可查询尚未加入应用的账号。 */
applicationRoutes.get(
  '/:id/member-candidates',
  requireMinRole('maintainer'),
  requireApplicationRole('id', 'maintainer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const q = (c.req.query('q') ?? '').trim()
    const filter = q
      ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
      : undefined
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        platformRole: users.role,
      })
      .from(users)
      .leftJoin(
        applicationMembers,
        and(
          eq(applicationMembers.applicationId, applicationId),
          eq(applicationMembers.userId, users.id),
        ),
      )
      .where(and(ne(users.role, 'admin'), isNull(applicationMembers.userId), filter))
      .orderBy(asc(users.name))
      .limit(30)
    return c.json({ items: rows, total: rows.length })
  },
)

/** 应用维护者可添加或更新成员。 */
applicationRoutes.put(
  '/:id/members/:userId',
  requireMinRole('maintainer'),
  requireApplicationRole('id', 'maintainer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const userId = c.req.param('userId')
    const parsed = memberRoleSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return jsonError(
        c,
        400,
        'invalid_body',
        'Invalid member payload',
        parsed.error.flatten(),
      )
    }
    const [target] = await db
      .select({ id: users.id, platformRole: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!target) return jsonError(c, 404, 'not_found', 'User not found')
    if (target.platformRole === 'admin') {
      return jsonError(
        c,
        400,
        'invalid_body',
        'Administrators do not need application membership',
      )
    }
    if (parsed.data.role === 'maintainer' && target.platformRole === 'viewer') {
      return jsonError(
        c,
        400,
        'platform_role_insufficient',
        'Viewer cannot be application maintainer',
      )
    }
    const [app] = await db
      .select({ ownerId: applications.ownerId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
    if (app?.ownerId === userId && parsed.data.role !== 'maintainer') {
      return jsonError(
        c,
        400,
        'owner_membership_required',
        'Application owner must remain maintainer',
      )
    }

    const [member] = await db
      .insert(applicationMembers)
      .values({ applicationId, userId, role: parsed.data.role, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [applicationMembers.applicationId, applicationMembers.userId],
        set: { role: parsed.data.role, updatedAt: new Date() },
      })
      .returning()
    return c.json({ member }, 200)
  },
)

applicationRoutes.delete(
  '/:id/members/:userId',
  requireMinRole('maintainer'),
  requireApplicationRole('id', 'maintainer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const userId = c.req.param('userId')
    const [app] = await db
      .select({ ownerId: applications.ownerId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
    if (app?.ownerId === userId) {
      return jsonError(
        c,
        400,
        'owner_membership_required',
        'Application owner must remain a member',
      )
    }
    await db
      .delete(applicationMembers)
      .where(
        and(
          eq(applicationMembers.applicationId, applicationId),
          eq(applicationMembers.userId, userId),
        ),
      )
    return c.json({ ok: true })
  },
)
