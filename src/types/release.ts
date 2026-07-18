import type { ArtifactType } from '@/types/artifact'

export type ReleaseStatus = 'published' | 'deprecated' | 'archived'

export interface Release {
  id: string
  applicationId: string
  version: string
  releaseNotes: string
  status: ReleaseStatus
  createdBy: string
  publishedAt: string
  artifactCount: number
  artifactTypes: ArtifactType[]
}
