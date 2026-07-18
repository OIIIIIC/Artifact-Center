import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { applications, artifacts } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
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

  const rows = await db.select().from(applications).where(where).orderBy(order)

  return c.json({ items: rows.map(mapApp), total: rows.length })
})

applicationRoutes.get('/:id', async (c) => {
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

  const [row] = await db
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

applicationRoutes.patch('/:id', requireMinRole('maintainer'), async (c) => {
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
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.packageName !== undefined ? { packageName: data.packageName.trim() } : {}),
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
})

applicationRoutes.delete('/:id', requireRoles('admin'), async (c) => {
  const id = c.req.param('id')
  const [existing] = await db
    .select({ id: applications.id, name: applications.name })
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1)
  if (!existing) return jsonError(c, 404, 'not_found', 'Application not found')

  await db.delete(applications).where(eq(applications.id, id))

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
applicationRoutes.get('/:id/artifacts', async (c) => {
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
      version: r.version,
      buildNumber: r.buildNumber,
      platform: r.platform,
      channel: r.channel,
      status: r.status,
      filename: r.filename,
      sizeBytes: r.sizeBytes,
      sha256: r.sha256,
      releaseNotes: r.releaseNotes,
      uploader: r.uploaderName,
      uploadedAt: r.uploadedAt.toISOString(),
    })),
  })
})
