import {
  decodeShareToken,
  isPayloadExpired,
  payloadToMode,
} from '@/features/share/share-token'
import { useApplicationsStore } from '@/store/applications-store'
import { useArtifactsStore } from '@/store/artifacts-store'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'
import type { ShareLink } from '@/types/share'

export type ShareResolveResult =
  | { ok: true; link: ShareLink; application: Application; artifact: Artifact }
  | {
      ok: false
      reason: 'not_found' | 'expired' | 'app_missing' | 'artifact_missing'
    }

/**
 * Resolve a share token to the downloadable artifact.
 * Token is self-contained (base64 payload) so it works across browsers
 * without shared server storage — as long as the app/artifact exists
 * in this client's catalog (seed mocks do; local-only publishes may not).
 */
export function resolveShareToken(token: string): ShareResolveResult {
  const payload = decodeShareToken(token)
  if (!payload) return { ok: false, reason: 'not_found' }
  if (isPayloadExpired(payload)) return { ok: false, reason: 'expired' }

  const mode = payloadToMode(payload.m)
  const applicationId = payload.a

  const application = useApplicationsStore.getState().getById(applicationId)
  if (!application) return { ok: false, reason: 'app_missing' }

  const artifacts = useArtifactsStore.getState()
  let artifact: Artifact | undefined

  if (mode === 'latest') {
    artifact = artifacts.getLatest(applicationId)
  } else if (payload.i) {
    artifact = artifacts.getForApplication(applicationId).find((a) => a.id === payload.i)
  }

  if (!artifact) return { ok: false, reason: 'artifact_missing' }

  const link: ShareLink = {
    id: `resolved-${payload.a}`,
    token,
    applicationId,
    mode,
    artifactId: payload.i,
    createdAt: new Date().toISOString(),
    expiresAt: payload.e != null ? new Date(payload.e).toISOString() : null,
    createdBy: '',
  }

  return { ok: true, link, application, artifact }
}
