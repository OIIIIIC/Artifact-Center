import type { artifacts } from '../db/schema.js'

export function mapArtifact(r: typeof artifacts.$inferSelect) {
  return {
    id: r.id,
    applicationId: r.applicationId,
    releaseId: r.releaseId,
    version: r.version,
    buildNumber: r.buildNumber,
    platform: r.platform,
    type: r.type,
    channel: r.channel,
    status: r.status,
    originalFilename: r.originalFilename,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    sha256: r.sha256,
    releaseNotes: r.releaseNotes,
    uploader: r.uploaderName,
    uploadedAt: r.uploadedAt.toISOString(),
    parsedMeta: r.parsedMeta,
    buildMeta: r.buildMeta,
  }
}
