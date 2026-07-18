import { createMiddleware } from 'hono/factory'

import { jsonError } from '../lib/errors.js'
import type { AuthVariables } from './auth.js'

/** After requireAuth — only admin role may proceed. */
export const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const user = c.get('user')
    if (!user || user.role !== 'admin') {
      return jsonError(c, 403, 'forbidden', 'Admin role required')
    }
    await next()
  },
)
