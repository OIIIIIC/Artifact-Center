import { useApplicationsStore } from '@/store/applications-store'
import { useArtifactsStore } from '@/store/artifacts-store'
import { isShareExpired, useShareStore } from '@/store/share-store'
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
 * Resolve a share token to the downloadable artifact (mock stores).
 */
export function resolveShareToken(token: string): ShareResolveResult {
  const link = useShareStore.getState().getByToken(token)
  if (!link) return { ok: false, reason: 'not_found' }
  if (isShareExpired(link)) return { ok: false, reason: 'expired' }

  const application = useApplicationsStore.getState().getById(link.applicationId)
  if (!application) return { ok: false, reason: 'app_missing' }

  const artifacts = useArtifactsStore.getState()
  let artifact: Artifact | undefined

  if (link.mode === 'latest') {
    artifact = artifacts.getLatest(link.applicationId)
  } else if (link.artifactId) {
    artifact = artifacts
      .getForApplication(link.applicationId)
      .find((a) => a.id === link.artifactId)
  }

  if (!artifact) return { ok: false, reason: 'artifact_missing' }

  return { ok: true, link, application, artifact }
}
