import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'

import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt.js'

export type AuthVariables = {
  user: AccessTokenPayload
}

/**
 * 用数据库中的当前账户状态校验已解码 JWT，并以当前平台角色覆盖过期 claim。
 * 密码、角色或账号状态变更后递增 tokenVersion 即可撤销所有旧令牌。
 */
export async function validateCurrentAuthUser<T extends AccessTokenPayload>(
  user: T,
): Promise<T | null> {
  const [current] = await db
    .select({
      id: users.id,
      role: users.role,
      tokenVersion: users.tokenVersion,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, user.sub))
    .limit(1)

  if (!current || !current.isActive || current.tokenVersion !== user.tokenVersion) {
    return null
  }

  return { ...user, role: current.role }
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
      const currentUser = await validateCurrentAuthUser(user)
      if (!currentUser) throw new Error('revoked_token')
      c.set('user', currentUser)
      await next()
    } catch {
      return jsonError(c, 401, 'unauthorized', 'Invalid or expired token')
    }
  },
)
