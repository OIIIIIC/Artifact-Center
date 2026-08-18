import { and, desc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { releaseCredentials } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import {
  createReleaseCredentialToken,
  hashReleaseCredentialToken,
} from '../lib/release-credential.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { requireRoles } from '../middleware/require-role.js'

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  expiresAt: z.string().datetime().optional(),
})

function mapCredential(row: typeof releaseCredentials.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    channels: ['beta', 'stable'] as const,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export const releaseCredentialRoutes = new Hono<{ Variables: AuthVariables }>()

releaseCredentialRoutes.use('*', requireAuth, requireRoles('admin'))

releaseCredentialRoutes.get('/', async (c) => {
  const rows = await db
    .select()
    .from(releaseCredentials)
    .orderBy(desc(releaseCredentials.createdAt))
  return c.json({ items: rows.map(mapCredential) })
})

releaseCredentialRoutes.post('/', async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return jsonError(c, 400, 'invalid_body', 'Invalid release credential payload')
  }
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null
  if (expiresAt && expiresAt <= new Date()) {
    return jsonError(c, 400, 'invalid_expiry', 'Expiry must be in the future')
  }

  const token = createReleaseCredentialToken()
  const user = c.get('user')
  const [row] = await db
    .insert(releaseCredentials)
    .values({
      actorUserId: user.sub,
      name: parsed.data.name,
      tokenHash: hashReleaseCredentialToken(token),
      expiresAt,
    })
    .returning()

  await writeAudit(c, {
    action: 'release_credential.create',
    objectType: 'release_credential',
    objectId: row.id,
    summary: `创建平台发布机器人 ${row.name}`,
    meta: {
      scope: 'all_applications',
      channels: ['beta', 'stable'],
      expiresAt: row.expiresAt?.toISOString() ?? null,
    },
  })
  return c.json({ credential: mapCredential(row), token }, 201)
})

releaseCredentialRoutes.delete('/:id', async (c) => {
  const [row] = await db
    .update(releaseCredentials)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(releaseCredentials.id, c.req.param('id')),
        isNull(releaseCredentials.revokedAt),
      ),
    )
    .returning()
  if (!row) {
    return jsonError(c, 404, 'not_found', 'Release credential not found')
  }
  await writeAudit(c, {
    action: 'release_credential.revoke',
    objectType: 'release_credential',
    objectId: row.id,
    summary: `撤销平台发布机器人 ${row.name}`,
  })
  return c.json({ ok: true })
})
