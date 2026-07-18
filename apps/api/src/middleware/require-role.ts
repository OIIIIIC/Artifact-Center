import { createMiddleware } from 'hono/factory'

import { jsonError } from '../lib/errors.js'
import type { AuthVariables } from './auth.js'

export type AppRole = 'admin' | 'maintainer' | 'viewer'

const RANK: Record<AppRole, number> = {
  viewer: 1,
  maintainer: 2,
  admin: 3,
}

/**
 * After requireAuth — user must have at least one of the given roles
 * (or higher rank if using minRole).
 */
export function requireRoles(...allowed: AppRole[]) {
  const set = new Set(allowed)
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = c.get('user')
    const role = (user?.role ?? 'viewer') as AppRole
    if (!set.has(role)) {
      return jsonError(c, 403, 'forbidden', 'Insufficient role')
    }
    await next()
  })
}

/** Require role rank ≥ minRole (viewer < maintainer < admin) */
export function requireMinRole(minRole: AppRole) {
  const need = RANK[minRole]
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = c.get('user')
    const role = (user?.role ?? 'viewer') as AppRole
    if ((RANK[role] ?? 0) < need) {
      return jsonError(c, 403, 'forbidden', 'Insufficient role')
    }
    await next()
  })
}
