import { and, desc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client.js'
import { mcpCredentials } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import {
  createMcpToken,
  hashMcpToken,
  isMcpAuthorization,
} from '../lib/mcp-credential.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  validDays: z.number().int().min(1).max(365).default(90),
})
const map = (row: typeof mcpCredentials.$inferSelect) => ({
  id: row.id,
  name: row.name,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
})
export const mcpCredentialRoutes = new Hono<{ Variables: AuthVariables }>()
mcpCredentialRoutes.use('*', requireAuth)
mcpCredentialRoutes.get('/', async (c) => {
  const rows = await db
    .select()
    .from(mcpCredentials)
    .where(eq(mcpCredentials.userId, c.get('user').sub))
    .orderBy(desc(mcpCredentials.createdAt))
  c.header('Cache-Control', 'no-store')
  return c.json({ items: rows.map(map) })
})
mcpCredentialRoutes.post('/', async (c) => {
  // Delegated credentials cannot mint a new credential to outlive revocation.
  if (isMcpAuthorization(c.req.header('authorization')))
    return jsonError(
      c,
      403,
      'forbidden',
      'Create MCP credentials from your website session',
    )
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return jsonError(c, 400, 'invalid_body', 'Invalid MCP credential')
  const user = c.get('user')
  const token = createMcpToken()
  const [row] = await db
    .insert(mcpCredentials)
    .values({
      userId: user.sub,
      name: parsed.data.name,
      tokenHash: hashMcpToken(token),
      tokenVersion: user.tokenVersion,
      expiresAt: new Date(Date.now() + parsed.data.validDays * 86400000),
    })
    .returning()
  await writeAudit(c, {
    action: 'mcp_credential.create',
    objectType: 'mcp_credential',
    objectId: row.id,
    summary: `创建个人 MCP 凭据 ${row.name}`,
  })
  c.header('Cache-Control', 'no-store')
  return c.json({ credential: map(row), token }, 201)
})
mcpCredentialRoutes.delete('/:id', async (c) => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success)
    return jsonError(c, 400, 'invalid_body', 'Invalid credential id')
  const [row] = await db
    .update(mcpCredentials)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(mcpCredentials.id, c.req.param('id')),
        eq(mcpCredentials.userId, c.get('user').sub),
        isNull(mcpCredentials.revokedAt),
      ),
    )
    .returning()
  if (!row) return jsonError(c, 404, 'not_found', 'MCP credential not found')
  await writeAudit(c, {
    action: 'mcp_credential.revoke',
    objectType: 'mcp_credential',
    objectId: row.id,
    summary: `撤销个人 MCP 凭据 ${row.name}`,
  })
  return c.json({ ok: true })
})
