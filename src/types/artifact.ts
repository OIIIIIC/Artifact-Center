import type { ApplicationPlatform } from '@/types/application'
import type { UploadChannel } from '@/types/upload'

/** Version / build lifecycle on an artifact row */
export type ArtifactStatus = 'latest' | 'stable' | 'beta' | 'deprecated' | 'archived'

export interface Artifact {
  id: string
  applicationId: string
  version: string
  buildNumber: string
  platform: ApplicationPlatform
  sizeBytes: number
  uploadedAt: string
  uploader: string
  /**
   * "Latest" is orthogonal to release channel.
   * status=latest means current recommended download; channel is 正式/测试/内部/弃用.
   */
  status: ArtifactStatus
  /** Release channel — always kept so Latest + Beta can show together */
  channel?: UploadChannel
  releaseNotes: string
  filename: string
  /** SHA-256 when provided by API */
  sha256?: string
}

/** Resolve channel for display (mocks may omit channel). */
export function getArtifactChannel(art: Artifact): UploadChannel {
  if (art.channel) return art.channel
  if (art.status === 'beta' || /-beta/i.test(art.version)) return 'beta'
  if (art.status === 'deprecated' || art.status === 'archived') return 'deprecated'
  return 'stable'
}

export const ARTIFACT_STATUS_LABEL: Record<ArtifactStatus, string> = {
  latest: 'Latest',
  stable: 'Stable',
  beta: 'Beta',
  deprecated: 'Deprecated',
  archived: 'Archived',
}
