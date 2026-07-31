import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'

import { db } from '../db/client.js'
import {
  applications,
  artifacts,
  regions,
  shareLinkItems,
  shareLinks,
} from '../db/schema.js'
import { hashShareToken } from './share-token.js'

export type ResolvedShareItem = {
  item: typeof shareLinkItems.$inferSelect
  application: typeof applications.$inferSelect
  region: typeof regions.$inferSelect
  artifact: typeof artifacts.$inferSelect | null
  unavailableReason: 'artifact_missing' | null
}

export type ShareResolution =
  | { status: 'not_found' | 'revoked' | 'expired' }
  | {
      status: 'ok'
      share: typeof shareLinks.$inferSelect
      items: ResolvedShareItem[]
    }

/**
 * 按公开 URL 中的明文令牌解析分享。
 * 优先匹配 token_hash；若命中遗留明文 token 列则就地升级为 hash 并清空明文。
 */
export async function resolveShare(token: string): Promise<ShareResolution> {
  const trimmed = token.trim()
  if (!trimmed) return { status: 'not_found' }

  const tokenHash = hashShareToken(trimmed)
  let [share] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.tokenHash, tokenHash))
    .limit(1)

  if (!share) {
    const [legacy] = await db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.token, trimmed), isNotNull(shareLinks.token)))
      .limit(1)
    if (legacy) {
      const [upgraded] = await db
        .update(shareLinks)
        .set({ tokenHash, token: null })
        .where(eq(shareLinks.id, legacy.id))
        .returning()
      share = upgraded ?? legacy
    }
  }

  if (!share) return { status: 'not_found' }
  if (share.revokedAt) return { status: 'revoked' }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return { status: 'expired' }
  }

  const rows = await db
    .select({ item: shareLinkItems, application: applications, region: regions })
    .from(shareLinkItems)
    .innerJoin(applications, eq(shareLinkItems.applicationId, applications.id))
    .innerJoin(regions, eq(applications.regionId, regions.id))
    .where(eq(shareLinkItems.shareLinkId, share.id))
    .orderBy(asc(shareLinkItems.sortOrder), asc(applications.name))

  const items = await Promise.all(
    rows.map(async ({ item, application, region }): Promise<ResolvedShareItem> => {
      let artifact: typeof artifacts.$inferSelect | null = null
      if (item.mode === 'artifact' && item.artifactId) {
        const [fixed] = await db
          .select()
          .from(artifacts)
          .where(eq(artifacts.id, item.artifactId))
          .limit(1)
        artifact = fixed ?? null
      } else if (item.mode === 'latest') {
        const candidates = await db
          .select()
          .from(artifacts)
          .where(eq(artifacts.applicationId, item.applicationId))
          .orderBy(desc(artifacts.uploadedAt))
        artifact =
          candidates.find((candidate) => candidate.status === 'latest') ??
          candidates.find((candidate) => candidate.status !== 'archived') ??
          candidates[0] ??
          null
      }

      return {
        item,
        application,
        region,
        artifact,
        unavailableReason: artifact ? null : 'artifact_missing',
      }
    }),
  )

  return { status: 'ok', share, items }
}

export async function resolveShareItem(token: string, itemId: string) {
  const resolution = await resolveShare(token)
  if (resolution.status !== 'ok') return resolution
  const resolvedItem = resolution.items.find((entry) => entry.item.id === itemId)
  if (!resolvedItem) return { status: 'item_not_found' as const }
  return { ...resolution, resolvedItem }
}
