import { and, asc, eq, ne, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { applications, regions } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { diagnostics } from '../lib/diagnostics.js'
import { jsonError } from '../lib/errors.js'
import {
  getRetentionPolicy,
  runRetentionCleanup,
  updateRetentionSettings,
} from '../lib/retention.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { requireRoles } from '../middleware/require-role.js'

const patchSchema = z.object({
  maxVersions: z.number().int().min(1).max(999).optional(),
  archiveDeprecatedDays: z.number().int().min(1).max(3650).optional(),
})

const regionCode = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)

const createRegionSchema = z.object({
  code: regionCode,
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  enabled: z.boolean().optional().default(true),
})

const updateRegionSchema = createRegionSchema.partial()

const diagnosticsSchema = z.object({
  sinceMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(30),
  requestId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._:-]{1,128}$/)
    .optional(),
  operation: z.string().trim().max(500).optional(),
  expected: z.string().trim().max(1000).optional(),
  actual: z.string().trim().max(1000).optional(),
  occurredAt: z.string().trim().max(120).optional(),
  client: z
    .object({
      page: z.string().trim().max(200).optional(),
      browser: z.string().trim().max(500).optional(),
      timezone: z.string().trim().max(100).optional(),
    })
    .optional(),
})

function mapRegion(row: typeof regions.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const settingsRoutes = new Hono<{ Variables: AuthVariables }>()

settingsRoutes.use('*', requireAuth)

/** POST /settings/diagnostics/report — 仅管理员生成进程内脱敏诊断报告。 */
settingsRoutes.post('/diagnostics/report', requireRoles('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = diagnosticsSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid diagnostics payload',
      parsed.error.flatten(),
    )
  }

  const report = await diagnostics.buildReport(parsed.data)
  await writeAudit(c, {
    action: 'settings.diagnostics_export',
    objectType: 'system',
    objectId: 'diagnostics',
    summary: `生成最近 ${parsed.data.sinceMinutes} 分钟的系统诊断包`,
    meta: {
      sinceMinutes: parsed.data.sinceMinutes,
      requestId: parsed.data.requestId ?? null,
      eventCount: report.eventCount,
    },
  })

  return c.json({ report })
})

/** GET /settings/regions — 所有登录用户可读取，供应用选择与目录分组。 */
settingsRoutes.get('/regions', async (c) => {
  const rows = await db
    .select()
    .from(regions)
    .orderBy(asc(regions.sortOrder), asc(regions.name))
  return c.json({ items: rows.map(mapRegion), total: rows.length })
})

/** POST /settings/regions — 仅管理员维护地域基础资料。 */
settingsRoutes.post('/regions', requireRoles('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createRegionSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid region payload',
      parsed.error.flatten(),
    )
  }

  const data = parsed.data
  const [duplicate] = await db
    .select({ id: regions.id })
    .from(regions)
    .where(or(eq(regions.code, data.code), eq(regions.name, data.name)))
    .limit(1)
  if (duplicate) {
    return jsonError(c, 409, 'region_taken', 'Region code or name already exists')
  }

  const [row] = await db.insert(regions).values(data).returning()

  await writeAudit(c, {
    action: 'settings.region_create',
    objectType: 'region',
    objectId: row.id,
    summary: `创建地域 ${row.name}`,
    meta: { code: row.code },
  })

  return c.json({ region: mapRegion(row) }, 201)
})

/** PATCH /settings/regions/:id — 停用只阻止新绑定，保留已有应用归属。 */
settingsRoutes.patch('/regions/:id', requireRoles('admin'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = updateRegionSchema.safeParse(body)
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonError(c, 400, 'invalid_body', 'Invalid region payload')
  }

  const [current] = await db.select().from(regions).where(eq(regions.id, id)).limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'Region not found')

  const nextCode = parsed.data.code ?? current.code
  const nextName = parsed.data.name ?? current.name
  const [duplicate] = await db
    .select({ id: regions.id })
    .from(regions)
    .where(
      and(ne(regions.id, id), or(eq(regions.code, nextCode), eq(regions.name, nextName))),
    )
    .limit(1)
  if (duplicate) {
    return jsonError(c, 409, 'region_taken', 'Region code or name already exists')
  }

  const [row] = await db
    .update(regions)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(regions.id, id))
    .returning()

  await writeAudit(c, {
    action: 'settings.region_update',
    objectType: 'region',
    objectId: row.id,
    summary: `更新地域 ${row.name}`,
    meta: { fields: Object.keys(parsed.data) },
  })

  return c.json({ region: mapRegion(row) })
})

/** DELETE /settings/regions/:id — 仅删除未被应用绑定的地域。 */
settingsRoutes.delete('/regions/:id', requireRoles('admin'), async (c) => {
  const id = c.req.param('id')
  const [region] = await db.select().from(regions).where(eq(regions.id, id)).limit(1)
  if (!region) return jsonError(c, 404, 'not_found', 'Region not found')

  const boundApplications = await db
    .select({ id: applications.id, name: applications.name })
    .from(applications)
    .where(eq(applications.regionId, id))
    .orderBy(asc(applications.name))

  if (boundApplications.length > 0) {
    return jsonError(c, 409, 'region_in_use', 'Region is assigned to applications', {
      applications: boundApplications,
    })
  }

  await db.delete(regions).where(eq(regions.id, id))
  await writeAudit(c, {
    action: 'settings.region_delete',
    objectType: 'region',
    objectId: id,
    summary: `删除地域 ${region.name}`,
    meta: { code: region.code },
  })

  return c.json({ ok: true })
})

/** GET /settings/retention */
settingsRoutes.get('/retention', async (c) => {
  const policy = await getRetentionPolicy()
  return c.json({ retention: policy })
})

/** PATCH /settings/retention — admin only */
settingsRoutes.patch('/retention', requireRoles('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid retention payload',
      parsed.error.flatten(),
    )
  }
  if (
    parsed.data.maxVersions === undefined &&
    parsed.data.archiveDeprecatedDays === undefined
  ) {
    return jsonError(c, 400, 'invalid_body', 'No fields to update')
  }

  const policy = await updateRetentionSettings(parsed.data)

  await writeAudit(c, {
    action: 'settings.retention_update',
    objectType: 'system',
    objectId: 'retention',
    summary: `更新保留策略（最多 ${policy.maxVersions} 版 / 弃用 ${policy.archiveDeprecatedDays} 天）`,
    meta: {
      maxVersions: policy.maxVersions,
      archiveDeprecatedDays: policy.archiveDeprecatedDays,
    },
  })

  return c.json({ retention: policy })
})

/** POST /settings/retention/run — admin: run cleanup now */
settingsRoutes.post('/retention/run', requireRoles('admin'), async (c) => {
  const report = await runRetentionCleanup()

  await writeAudit(c, {
    action: 'settings.retention_run',
    objectType: 'system',
    objectId: 'retention',
    summary: `执行保留清理：删除 ${report.deletedVersions} 个版本，归档 ${report.archivedDeprecated} 个`,
    meta: report,
  })

  const policy = await getRetentionPolicy()
  return c.json({ report, retention: policy })
})
