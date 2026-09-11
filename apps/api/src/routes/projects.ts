import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { applications, projects, regions } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import type { AuthVariables } from '../middleware/auth.js'
import { requireRoles } from '../middleware/require-role.js'

export const projectDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  enabled: z.boolean().default(true),
})
const uuid = z.string().uuid()
const mapProject = (row: typeof projects.$inferSelect) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

function constraintCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const e = error as { code?: string; cause?: unknown }
  return e.code ?? constraintCode(e.cause)
}

/** Mounted under authenticated settings. Catalog metadata is public to signed-in users;
 * application counts and application access remain membership-scoped. */
export const projectRoutes = new Hono<{ Variables: AuthVariables }>()

projectRoutes.get('/projects', async (c) => {
  const productId = c.req.query('productId')
  if (productId && !uuid.safeParse(productId).success)
    return jsonError(c, 400, 'invalid_body', 'Invalid product id')
  const rows = await db
    .select()
    .from(projects)
    .where(productId ? eq(projects.productId, productId) : undefined)
    .orderBy(asc(projects.sortOrder), asc(projects.name))
  return c.json({ items: rows.map(mapProject), total: rows.length })
})

// 保存完整顺序，事务内检查浏览时的顺序，避免并发维护覆盖其他人的调整。
projectRoutes.put('/projects/order', requireRoles('admin'), async (c) => {
  const parsed = z
    .object({
      productId: uuid,
      projectIds: z.array(uuid).min(1).max(10_000),
      expectedOrder: z.array(uuid).min(1).max(10_000),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (
    !parsed.success ||
    new Set(parsed.data.projectIds).size !== parsed.data.projectIds.length
  )
    return jsonError(c, 400, 'invalid_body', 'Invalid project order')
  const { productId, projectIds, expectedOrder } = parsed.data
  const result = await db.transaction(async (tx) => {
    // 锁定产品及项目；新项目的外键检查也会等待产品锁释放。
    const [product] = await tx
      .select()
      .from(regions)
      .where(eq(regions.id, productId))
      .for('update')
    if (!product) return { kind: 'missing' as const }
    const current = await tx
      .select()
      .from(projects)
      .where(eq(projects.productId, productId))
      .orderBy(asc(projects.sortOrder), asc(projects.name))
      .for('update')
    const ids = new Set(current.map((p) => p.id))
    if (
      current.length !== projectIds.length ||
      projectIds.some((id) => !ids.has(id)) ||
      expectedOrder.length !== current.length ||
      current.some((p, i) => p.id !== expectedOrder[i])
    )
      return { kind: 'conflict' as const }
    const rows = await tx
      .update(projects)
      .set({
        sortOrder: sql`case ${projects.id} ${sql.join(
          projectIds.map((id, index) => sql`when ${id}::uuid then ${index}::integer`),
          sql` `,
        )} end`,
        updatedAt: new Date(),
      })
      .where(eq(projects.productId, productId))
      .returning()
    return { kind: 'saved' as const, name: product.name, rows }
  })
  if (result.kind === 'missing')
    return jsonError(c, 404, 'not_found', 'Product not found')
  if (result.kind === 'conflict')
    return jsonError(
      c,
      409,
      'project_order_changed',
      'Project list has changed; refresh and try again',
    )
  await writeAudit(c, {
    action: 'settings.project_reorder',
    objectType: 'region',
    objectId: productId,
    summary: `调整产品 ${result.name} 的项目顺序`,
    meta: { projectIds },
  })
  return c.json({
    items: result.rows.sort((a, b) => a.sortOrder - b.sortOrder).map(mapProject),
  })
})

projectRoutes.post('/projects', requireRoles('admin'), async (c) => {
  const parsed = projectDraftSchema
    .extend({ productId: uuid })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return jsonError(c, 400, 'invalid_body', 'Invalid project payload')
  const [product] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, parsed.data.productId))
    .limit(1)
  if (!product?.enabled)
    return jsonError(c, 400, 'region_unavailable', 'Product is unavailable')
  try {
    const [row] = await db.insert(projects).values(parsed.data).returning()
    await writeAudit(c, {
      action: 'settings.project_create',
      objectType: 'project',
      objectId: row.id,
      summary: `创建项目 ${product.name} / ${row.name}`,
      meta: { productId: row.productId },
    })
    return c.json({ project: mapProject(row) }, 201)
  } catch (error) {
    if (constraintCode(error) === '23505')
      return jsonError(
        c,
        409,
        'project_taken',
        'Project name already exists in this product',
      )
    throw error
  }
})

projectRoutes.patch('/projects/:id', requireRoles('admin'), async (c) => {
  const id = c.req.param('id')
  const parsed = projectDraftSchema
    .partial()
    .safeParse(await c.req.json().catch(() => null))
  if (!uuid.safeParse(id).success || !parsed.success || !Object.keys(parsed.data).length)
    return jsonError(c, 400, 'invalid_body', 'Invalid project payload')
  const [current] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'Project not found')
  if (current.isDefault && parsed.data.enabled === false)
    return jsonError(
      c,
      409,
      'default_project_required',
      'The default project must remain available',
    )
  try {
    const [row] = await db
      .update(projects)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning()
    await writeAudit(c, {
      action: 'settings.project_update',
      objectType: 'project',
      objectId: id,
      summary: `更新项目 ${row.name}`,
      meta: { productId: row.productId, fields: Object.keys(parsed.data) },
    })
    return c.json({ project: mapProject(row) })
  } catch (error) {
    if (constraintCode(error) === '23505')
      return jsonError(
        c,
        409,
        'project_taken',
        'Project name already exists in this product',
      )
    throw error
  }
})

projectRoutes.delete('/projects/:id', requireRoles('admin'), async (c) => {
  const id = c.req.param('id')
  if (!uuid.safeParse(id).success)
    return jsonError(c, 400, 'invalid_body', 'Invalid project id')
  const [current] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'Project not found')
  if (current.isDefault)
    return jsonError(
      c,
      409,
      'default_project_required',
      'The default project cannot be deleted',
    )
  const [bound] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.projectId, id))
    .limit(1)
  if (bound)
    return jsonError(
      c,
      409,
      'project_in_use',
      'Move applications before deleting this project',
    )
  try {
    await db
      .delete(projects)
      .where(and(eq(projects.id, id), ne(projects.isDefault, true)))
    await writeAudit(c, {
      action: 'settings.project_delete',
      objectType: 'project',
      objectId: id,
      summary: `删除项目 ${current.name}`,
      meta: { productId: current.productId },
    })
    return c.json({ ok: true })
  } catch (error) {
    if (constraintCode(error) === '23503')
      return jsonError(
        c,
        409,
        'project_in_use',
        'Move applications before deleting this project',
      )
    throw error
  }
})
