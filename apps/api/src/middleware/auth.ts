import { createMiddleware } from 'hono/factory'

import { jsonError } from '../lib/errors.js'
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt.js'

export type AuthVariables = {
  user: AccessTokenPayload
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const header = c.req.header('authorization')
    if (!header?.startsWith('Bearer ')) {
      return jsonError(c, 401, 'unauthorized', 'Missing or invalid Authorization header')
    }
    const token = header.slice('Bearer '.length).trim()
    try {
      const user = await verifyAccessToken(token)
      c.set('user', user)
      await next()
    } catch {
      return jsonError(c, 401, 'unauthorized', 'Invalid or expired token')
    }
  },
)
