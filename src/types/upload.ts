import type { ApplicationPlatform } from '@/types/application'

export type UploadStep = 1 | 2 | 3 | 4

export type UploadChannel = 'stable' | 'beta' | 'internal' | 'deprecated'

export type UploadPhase =
  'idle' | 'uploading' | 'verifying' | 'hashing' | 'ready' | 'error'

export type UploadFileError = 'too_large' | 'wrong_platform' | 'unsupported' | 'empty'

export type PublishError = 'duplicate_version' | null

export type FileKind =
  'apk' | 'aab' | 'exe' | 'zip' | 'ipa' | 'firmware' | 'docker' | 'unknown'

export interface ParsedArtifactFile {
  name: string
  sizeBytes: number
  kind: FileKind
  platform: ApplicationPlatform | null
  hash: string
  suggestedVersion: string
  suggestedBuild: string
  suggestedPackageName: string
}

export interface VersionDraft {
  version: string
  buildNumber: string
  packageName: string
  platform: ApplicationPlatform | ''
  channel: UploadChannel
  releaseNotes: string
  markLatest: boolean
}

export const UPLOAD_MAX_BYTES = 200 * 1024 * 1024 // 200 MB mock limit

export const CHANNEL_LABEL: Record<UploadChannel, string> = {
  stable: 'Stable',
  beta: 'Beta',
  internal: 'Internal',
  deprecated: 'Deprecated',
}

export const STEP_LABELS: Record<UploadStep, string> = {
  1: 'Application',
  2: 'Artifact',
  3: 'Version',
  4: 'Review',
}
