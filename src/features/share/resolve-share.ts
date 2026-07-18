import { apiResolveShare } from '@/services/api'
import { ApiError } from '@/services/http'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'
import type { ShareLink } from '@/types/share'

export type ShareResolveOk = {
  ok: true
  link: ShareLink
  application: Application
  artifact: Artifact
  sharedBy: string | null
  /** Prefer share-token download when set */
  serverToken?: string
}

export type ShareResolveFail = {
  ok: false
  reason: 'not_found' | 'expired' | 'revoked' | 'app_missing' | 'artifact_missing'
  sharedBy: string | null
  applicationName: string | null
}

export type ShareResolveResult = ShareResolveOk | ShareResolveFail

/** Resolve server-issued opaque share token. */
export async function resolveShareToken(token: string): Promise<ShareResolveResult> {
  if (!token?.trim()) {
    return { ok: false, reason: 'not_found', sharedBy: null, applicationName: null }
  }

  // 1) Server share
  try {
    const data = await apiResolveShare(token.trim())
    return {
      ok: true,
      link: {
        id: data.share.id,
        token: data.share.token,
        applicationId: data.application.id,
        mode: data.share.mode,
        createdAt: data.share.createdAt,
        expiresAt: data.share.expiresAt,
        createdBy: data.share.createdBy,
      },
      application: data.application,
      artifact: data.artifact,
      sharedBy: data.share.createdBy?.trim() || null,
      serverToken: data.share.token,
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === 'expired' || err.status === 410) {
        if (err.code === 'revoked') {
          return {
            ok: false,
            reason: 'revoked',
            sharedBy: null,
            applicationName: null,
          }
        }
        // 410 can be expired or revoked
        const reason =
          err.code === 'revoked' || /revok/i.test(err.message) ? 'revoked' : 'expired'
        return { ok: false, reason, sharedBy: null, applicationName: null }
      }
      if (err.code === 'app_missing') {
        return {
          ok: false,
          reason: 'app_missing',
          sharedBy: null,
          applicationName: null,
        }
      }
      if (err.code === 'artifact_missing') {
        return {
          ok: false,
          reason: 'artifact_missing',
          sharedBy: null,
          applicationName: null,
        }
      }
    }
    return { ok: false, reason: 'not_found', sharedBy: null, applicationName: null }
  }
}
