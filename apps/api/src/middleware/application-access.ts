import { and, eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'

import { db } from '../db/client.js'
import { applicationMembers } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import type { AuthVariables } from './auth.js'

export type ApplicationRole = 'viewer' | 'maintainer'

const RANK: Record<ApplicationRole | 'admin', number> = {
  viewer: 1,
  maintainer: 2,
  admin: 3,
}

export async function hasApplicationRole(
  user: { sub: string; role: string },
  applicationId: string,
  required: ApplicationRole,
): Promise<boolean> {
  if (user.role === 'admin') return true

  const [member] = await db
    .select({ role: applicationMembers.role })
    .from(applicationMembers)
    .where(
      and(
        eq(applicationMembers.applicationId, applicationId),
        eq(applicationMembers.userId, user.sub),
      ),
    )
    .limit(1)

  return member != null && RANK[member.role] >= RANK[required]
}

/** 要求当前用户在路由参数所指应用内具备相应角色。 */
export function requireApplicationRole(parameter: string, required: ApplicationRole) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const applicationId = c.req.param(parameter)
    const user = c.get('user')
    if (!applicationId || !(await hasApplicationRole(user, applicationId, required))) {
      return jsonError(c, 403, 'forbidden', 'Insufficient application role')
    }
    await next()
  })
}
