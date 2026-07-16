import type { ApplicationPlatform } from '@/types/application'

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
  status: ArtifactStatus
  releaseNotes: string
  filename: string
}

export const ARTIFACT_STATUS_LABEL: Record<ArtifactStatus, string> = {
  latest: 'Latest',
  stable: 'Stable',
  beta: 'Beta',
  deprecated: 'Deprecated',
  archived: 'Archived',
}
