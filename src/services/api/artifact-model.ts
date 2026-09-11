import type { ApplicationPlatform } from '@/types/application'
import type { Artifact, ArtifactStatus } from '@/types/artifact'
import type { UploadChannel } from '@/types/upload'

export type ApiArtifact = {
  id: string
  applicationId: string
  releaseId?: string
  version: string
  buildNumber: string
  platform: ApplicationPlatform
  type?: Artifact['type']
  channel: UploadChannel
  status: ArtifactStatus
  originalFilename?: string
  filename: string
  sizeBytes: number
  sha256?: string | null
  releaseNotes: string
  uploader: string
  uploadedAt: string
  parsedMeta?: Record<string, unknown> | null
  buildMeta?: Record<string, unknown> | null
}

export function mapArtifact(a: ApiArtifact): Artifact {
  return {
    id: a.id,
    applicationId: a.applicationId,
    releaseId: a.releaseId,
    version: a.version,
    buildNumber: a.buildNumber,
    platform: a.platform,
    type: a.type,
    channel: a.channel,
    status: a.status,
    originalFilename: a.originalFilename,
    filename: a.filename,
    sizeBytes: a.sizeBytes,
    sha256: a.sha256 ?? undefined,
    releaseNotes: a.releaseNotes,
    uploader: a.uploader,
    uploadedAt: a.uploadedAt,
    parsedMeta: a.parsedMeta,
    buildMeta: a.buildMeta,
  }
}
