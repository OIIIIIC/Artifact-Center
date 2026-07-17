import {
  decodeShareToken,
  isPayloadExpired,
  payloadToMode,
  type SharePayloadV1,
} from '@/features/share/share-token'
import { useApplicationsStore } from '@/store/applications-store'
import { useArtifactsStore } from '@/store/artifacts-store'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'
import type { ShareLink } from '@/types/share'

export type ShareResolveOk = {
  ok: true
  link: ShareLink
  application: Application
  artifact: Artifact
  sharedBy: string | null
}

export type ShareResolveFail = {
  ok: false
  reason: 'not_found' | 'expired' | 'app_missing' | 'artifact_missing'
  /** From token — still useful when expired / no build */
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
 * Resolve a self-contained share token.
 * `sharedBy` is always read from the token when present (incl. expired).
 */
export function resolveShareToken(token: string): ShareResolveResult {
  const payload = decodeShareToken(token)
  if (!payload) {
    return { ok: false, reason: 'not_found', sharedBy: null, applicationName: null }
  }

  const sharedBy = sharedByOf(payload)
  const application = useApplicationsStore.getState().getById(payload.a)
  const applicationName = application?.name ?? null

  if (isPayloadExpired(payload)) {
    return {
      ok: false,
      reason: 'expired',
      sharedBy,
      applicationName,
    }
  }

  if (!application) {
    return {
      ok: false,
      reason: 'app_missing',
      sharedBy,
      applicationName: null,
    }
  }

  const mode = payloadToMode(payload.m)
  const artifacts = useArtifactsStore.getState()
  let artifact: Artifact | undefined

  if (mode === 'latest') {
    artifact = artifacts.getLatest(payload.a)
  } else if (payload.i) {
    artifact = artifacts.getForApplication(payload.a).find((a) => a.id === payload.i)
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
