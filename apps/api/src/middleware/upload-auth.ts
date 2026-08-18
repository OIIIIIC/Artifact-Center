import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'

import { db } from '../db/client.js'
import { releaseCredentials, users } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import {
  hashReleaseCredentialToken,
  isReleaseCredentialToken,
} from '../lib/release-credential.js'
import { verifyAccessToken } from '../lib/jwt.js'
import { validateCurrentAuthUser, type AuthVariables } from './auth.js'

export type UploadCredential =
  | { kind: 'user' }
  | {
      kind: 'release-credential'
      id: string
    }

export type UploadAuthVariables = AuthVariables & {
  uploadCredential: UploadCredential
}

export const requireUploadAuth = createMiddleware<{
  Variables: UploadAuthVariables
}>(async (c, next) => {
  const header = c.req.header('authorization')
  if (!header?.startsWith('Bearer ')) {
    return jsonError(c, 401, 'unauthorized', 'Missing or invalid Authorization header')
  }
  const token = header.slice('Bearer '.length).trim()
  let user: AuthVariables['user']
  let credential: UploadCredential
  let releaseCredentialId: string | null = null

  try {
    if (!isReleaseCredentialToken(token)) {
      const currentUser = await validateCurrentAuthUser(await verifyAccessToken(token))
      if (!currentUser) throw new Error('revoked_token')
      user = currentUser
      credential = { kind: 'user' }
    } else {
      const now = new Date()
      const [row] = await db
        .select({
          id: releaseCredentials.id,
          actorUserId: releaseCredentials.actorUserId,
          email: users.email,
          name: users.name,
          role: users.role,
          tokenVersion: users.tokenVersion,
        })
        .from(releaseCredentials)
        .innerJoin(users, eq(users.id, releaseCredentials.actorUserId))
        .where(
          and(
            eq(releaseCredentials.tokenHash, hashReleaseCredentialToken(token)),
            isNull(releaseCredentials.revokedAt),
            eq(users.isActive, true),
            or(
              isNull(releaseCredentials.expiresAt),
              gt(releaseCredentials.expiresAt, now),
            ),
          ),
        )
        .limit(1)

      if (!row) throw new Error('invalid_release_credential')
      user = {
        sub: row.actorUserId,
        email: row.email,
        name: row.name,
        role: row.role,
        tokenVersion: row.tokenVersion,
      }
      credential = {
        kind: 'release-credential',
        id: row.id,
      }
      releaseCredentialId = row.id
    }
  } catch {
    return jsonError(c, 401, 'unauthorized', 'Invalid or expired credential')
  }

  c.set('user', user)
  c.set('uploadCredential', credential)
  if (releaseCredentialId) {
    void db
      .update(releaseCredentials)
      .set({ lastUsedAt: new Date() })
      .where(eq(releaseCredentials.id, releaseCredentialId))
      .catch(() => undefined)
  }
  await next()
})
