import { and, isNotNull, isNull, lte } from 'drizzle-orm'

import { db } from '../db/client.js'
import { shareLinks } from '../db/schema.js'

export type ShareExpirationCleanupReport = {
  revoked: number
}

/**
 * Expired capability links must not stay "active" in management views.
 * The public resolver still enforces expiresAt as an immediate backstop.
 */
export async function revokeExpiredShares(
  now = new Date(),
): Promise<ShareExpirationCleanupReport> {
  const revoked = await db
    .update(shareLinks)
    .set({ revokedAt: now })
    .where(
      and(
        isNull(shareLinks.revokedAt),
        isNotNull(shareLinks.expiresAt),
        lte(shareLinks.expiresAt, now),
      ),
    )
    .returning({ id: shareLinks.id })

  return { revoked: revoked.length }
}
