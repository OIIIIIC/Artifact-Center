import {
  artifactFromSnapshot,
  decodeShareToken,
  isPayloadExpired,
  payloadToMode,
  type SharePayloadV1,
} from '@/features/share/share-token'
import {
  apiPublicGetApplication,
  apiPublicListArtifacts,
  apiResolveShare,
} from '@/services/api'
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

function sharedByOf(payload: SharePayloadV1): string | null {
  const b = payload.b?.trim()
  return b ? b : null
}

function linkFromPayload(token: string, payload: SharePayloadV1): ShareLink {
  const mode = payloadToMode(payload.m)
  return {
    id: `resolved-${payload.a}`,
    token,
    applicationId: payload.a,
    mode,
    artifactId: payload.i,
    createdAt: new Date().toISOString(),
    expiresAt: payload.e != null ? new Date(payload.e).toISOString() : null,
    createdBy: payload.b?.trim() || '',
  }
}

/**
 * Resolve share token: server-issued opaque tokens first, then legacy
 * self-contained base64 tokens for old links.
 */
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
      if (err.code === 'artifact_missing' || err.status === 404) {
        // fall through to legacy if looks like client token; else map artifact
        if (err.code === 'artifact_missing') {
          return {
            ok: false,
            reason: 'artifact_missing',
            sharedBy: null,
            applicationName: null,
          }
        }
        // not_found on server → try legacy
      } else if (err.status !== 404) {
        return { ok: false, reason: 'not_found', sharedBy: null, applicationName: null }
      }
    }
  }

  // 2) Legacy self-contained token
  return resolveLegacyToken(token.trim())
}

async function resolveLegacyToken(token: string): Promise<ShareResolveResult> {
  const payload = decodeShareToken(token)
  if (!payload) {
    return { ok: false, reason: 'not_found', sharedBy: null, applicationName: null }
  }

  const sharedBy = sharedByOf(payload)
  const fallbackName = payload.n?.trim() ?? null

  if (isPayloadExpired(payload)) {
    return {
      ok: false,
      reason: 'expired',
      sharedBy,
      applicationName: fallbackName,
    }
  }

  let application: Application
  try {
    application = await apiPublicGetApplication(payload.a)
  } catch {
    return {
      ok: false,
      reason: 'app_missing',
      sharedBy,
      applicationName: fallbackName,
    }
  }

  const mode = payloadToMode(payload.m)
  let artifact: Artifact | undefined

  if (mode === 'latest') {
    try {
      const items = await apiPublicListArtifacts(payload.a)
      artifact = items.find((a) => a.status === 'latest') ?? items[0]
    } catch {
      artifact = undefined
    }
  } else {
    artifact = artifactFromSnapshot(payload) ?? undefined
    if (!artifact && payload.i) {
      try {
        const items = await apiPublicListArtifacts(payload.a)
        artifact = items.find((a) => a.id === payload.i)
      } catch {
        // keep undefined
      }
    }
  }

  if (!artifact) {
    return {
      ok: false,
      reason: 'artifact_missing',
      sharedBy,
      applicationName: application.name,
    }
  }

  return {
    ok: true,
    link: linkFromPayload(token, payload),
    application,
    artifact,
    sharedBy,
  }
}
