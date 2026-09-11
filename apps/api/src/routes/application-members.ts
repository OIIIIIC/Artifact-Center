import { and, asc, eq, ilike, isNull, ne, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import { applicationMembers, applications, users } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import { requireApplicationRole } from '../middleware/application-access.js'
import { type AuthVariables } from '../middleware/auth.js'
import { memberRoleSchema } from './application-inputs.js'

export function registerApplicationMembers(
  applicationRoutes: Hono<{ Variables: AuthVariables }>,
) {
  applicationRoutes.get(
    '/:id/member-candidates',
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
          avatarUrl: users.avatarUrl,
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

  applicationRoutes.put(
    '/:id/members/:userId',
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
}
