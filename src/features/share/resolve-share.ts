import { apiResolveShare } from '@/services/api'
import { ApiError } from '@/services/http'
import type { Region } from '@/types/application'
import type { ResolvedShareItem, ShareKind } from '@/types/share'

export type ShareResolveOk = {
  ok: true
  link: {
    id: string
    token: string
    kind: ShareKind
    title: string
    regionId: string | null
    createdAt: string
    expiresAt: string | null
    downloadCount: number
  }
  region: Region | null
  items: ResolvedShareItem[]
  sharedBy: string | null
  serverToken: string
}

export type ShareResolveFail = {
  ok: false
  reason: 'not_found' | 'expired' | 'revoked'
  sharedBy: string | null
}

export type ShareResolveResult = ShareResolveOk | ShareResolveFail

/** 解析服务端签发的单项链接或 Share Collection。 */
export async function resolveShareToken(token: string): Promise<ShareResolveResult> {
  if (!token?.trim()) return { ok: false, reason: 'not_found', sharedBy: null }

  try {
    const data = await apiResolveShare(token.trim())
    return {
      ok: true,
      link: data.share,
      region: data.region,
      items: data.items,
      sharedBy: data.share.createdBy?.trim() || null,
      serverToken: data.share.token,
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 410) {
      return {
        ok: false,
        reason: error.code === 'revoked' ? 'revoked' : 'expired',
        sharedBy: null,
      }
    }
    return { ok: false, reason: 'not_found', sharedBy: null }
  }
}
