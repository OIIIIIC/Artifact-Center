import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { mcpCredentials, users } from '../db/schema.js'
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js'

export const hashMcpToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')
export const createMcpToken = () => `acmt_${randomBytes(32).toString('base64url')}`
export const isMcpAuthorization = (header: string | undefined) =>
  Boolean(header?.startsWith('Bearer ') && header.slice(7).trim().startsWith('acmt_'))

/** 返回账号当前状态，不能使用创建凭据时缓存的角色。 */
export async function verifyAccountToken(token: string): Promise<AccessTokenPayload> {
  if (!token.startsWith('acmt_')) return verifyAccessToken(token)
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      tokenVersion: users.tokenVersion,
    })
    .from(mcpCredentials)
    .innerJoin(users, eq(users.id, mcpCredentials.userId))
    .where(
      and(
        eq(mcpCredentials.tokenHash, hashMcpToken(token)),
        isNull(mcpCredentials.revokedAt),
        gt(mcpCredentials.expiresAt, new Date()),
        eq(users.isActive, true),
        eq(mcpCredentials.tokenVersion, users.tokenVersion),
      ),
    )
    .limit(1)
  if (!row) throw new Error('invalid_mcp_credential')
  return {
    sub: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tokenVersion: row.tokenVersion,
  }
}
