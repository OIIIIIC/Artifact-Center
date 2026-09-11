import type { ApplicationPlatform, ApplicationStatus } from '@/types/application'
import type { UploadChannel } from '@/types/upload'

/** Version / build lifecycle on an artifact row */
export type ArtifactStatus = 'latest' | 'stable' | 'beta' | 'deprecated' | 'archived'
import type { ArtifactType } from '@/lib/artifact-types'
export type { ArtifactType } from '@/lib/artifact-types'
export type ArtifactRiskStatus = 'beta' | 'deprecated' | 'archived'
export type ApplicationDownloadRiskStatus =
  'applicationBeta' | 'applicationDeprecated' | 'applicationArchived'
export type ArtifactOperationRiskStatus =
  ArtifactRiskStatus | ApplicationDownloadRiskStatus

export interface Artifact {
  id: string
  applicationId: string
  releaseId?: string
  version: string
  buildNumber: string
  platform: ApplicationPlatform
  type?: ArtifactType
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
  /** Filename supplied by the uploader, retained for provenance. */
  originalFilename?: string
  /** Immutable distribution filename used for downloads and shares. */
  filename: string
  /** SHA-256 when provided by API */
  sha256?: string
  parsedMeta?: Record<string, unknown> | null
  buildMeta?: Record<string, unknown> | null
}

/** Resolve channel for display (mocks may omit channel). */
export function getArtifactChannel(art: Artifact): UploadChannel {
  if (art.channel) return art.channel
  if (art.status === 'beta' || /-beta/i.test(art.version)) return 'beta'
  if (art.status === 'deprecated' || art.status === 'archived') return 'deprecated'
  return 'stable'
}

/** 需要在下载或分享前明确提示用户的生命周期状态。 */
export function getArtifactRiskStatus(art: Artifact): ArtifactRiskStatus | null {
  if (art.status === 'archived') return 'archived'
  if (art.status === 'deprecated' || art.channel === 'deprecated') return 'deprecated'
  if (art.status === 'beta' || art.channel === 'beta') return 'beta'
  return null
}

/** 应用处于非正式生命周期时，下载前需明确说明当前用途。 */
export function getApplicationDownloadRiskStatus(
  status: ApplicationStatus | undefined,
): ApplicationDownloadRiskStatus | null {
  if (status === 'archived') return 'applicationArchived'
  if (status === 'deprecated') return 'applicationDeprecated'
  if (status === 'beta') return 'applicationBeta'
  return null
}

export const ARTIFACT_STATUS_LABEL: Record<ArtifactStatus, string> = {
  latest: 'Latest',
  stable: 'Stable',
  beta: 'Beta',
  deprecated: 'Deprecated',
  archived: 'Archived',
}
