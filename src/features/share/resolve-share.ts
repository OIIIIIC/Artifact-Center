import {
  artifactFromSnapshot,
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
 * Pinned shares carry a full artifact snapshot so they work across browsers.
 */
export function resolveShareToken(token: string): ShareResolveResult {
  const payload = decodeShareToken(token)
  if (!payload) {
    return { ok: false, reason: 'not_found', sharedBy: null, applicationName: null }
  }

  const sharedBy = sharedByOf(payload)
  const application = useApplicationsStore.getState().getById(payload.a)
  const applicationName = application?.name ?? payload.n?.trim() ?? null

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
      applicationName: payload.n?.trim() ?? null,
    }
  }

  const mode = payloadToMode(payload.m)
  const artifacts = useArtifactsStore.getState()
  let artifact: Artifact | undefined

  if (mode === 'latest') {
    artifact = artifacts.getLatest(payload.a)
  } else {
    // 1) Prefer snapshot embedded in token (cross-browser)
    artifact = artifactFromSnapshot(payload) ?? undefined
    // 2) Fallback: local catalog by id (legacy tokens)
    if (!artifact && payload.i) {
      artifact = artifacts.getForApplication(payload.a).find((a) => a.id === payload.i)
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
