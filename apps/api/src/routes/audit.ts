import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '../db/client.js'
import { auditLogs } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { hasApplicationRole } from '../middleware/application-access.js'

/**
 * GET /audit — activity feed.
 * Query: applicationId?, limit? (default 50, max 200)
 */
export const auditRoutes = new Hono<{ Variables: AuthVariables }>()

auditRoutes.use('*', requireAuth)

auditRoutes.get('/', async (c) => {
  const applicationId = c.req.query('applicationId')?.trim()
  const limitRaw = Number(c.req.query('limit') ?? 50)
  const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50))
  const offsetRaw = Number(c.req.query('offset') ?? 0)
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0)

  if (applicationId) {
    // UUID shape guard
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        applicationId,
      )
    ) {
      return jsonError(c, 400, 'invalid_query', 'Invalid applicationId')
    }
  }

  const user = c.get('user')
  if (applicationId && !(await hasApplicationRole(user, applicationId, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  const rows = applicationId
    ? await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.applicationId, applicationId))
        .orderBy(desc(auditLogs.createdAt))
        .offset(offset)
        .limit(limit)
    : await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .offset(offset)
        .limit(limit)

  // Non-admins only see entries that are app-scoped when not filtering?
  // For MVP: all authenticated users can read audit (internal tool).
  // Tighten later if needed with requireAdmin for global feed.
  if (!applicationId && user.role !== 'admin') {
    // Maintainers/viewers: only return app-related entries (no user.* / global noise)
    const filtered = rows.filter(
      (r) =>
        r.applicationId != null ||
        r.objectType === 'application' ||
        r.objectType === 'artifact',
    )
    return c.json({
      items: filtered.map(mapRow),
      nextOffset: filtered.length === limit ? offset + filtered.length : null,
    })
  }

  return c.json({
    items: rows.map(mapRow),
    nextOffset: rows.length === limit ? offset + rows.length : null,
  })
})

function mapRow(r: typeof auditLogs.$inferSelect) {
  return {
    id: r.id,
    actorId: r.actorId,
    actorName: r.actorName,
    action: r.action,
    objectType: r.objectType,
    objectId: r.objectId,
    applicationId: r.applicationId,
    summary: r.summary,
    meta: r.meta,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
  }
}
