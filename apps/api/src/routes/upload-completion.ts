import { asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import {
  applications,
  artifacts,
  regions,
  releases,
  uploadParts,
  uploadSessions,
} from '../db/schema.js'
import { distributionFilename } from '../lib/artifact-filename.js'
import { refreshApplicationArtifactStats } from '../lib/artifact-helpers.js'
import { mapArtifact } from '../lib/artifact-response.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import {
  completeObjectMultipartUpload,
  deleteObject,
  hashObject,
} from '../lib/object-storage.js'
import { enforceRetentionAfterUpload } from '../lib/retention.js'
import {
  assembleUploadParts,
  deleteStorageFile,
  deleteUploadSessionFiles,
} from '../lib/storage.js'
import { requireUploadAuth, type UploadAuthVariables } from '../middleware/upload-auth.js'
import {
  channelEnum,
  getSessionForUser,
  isUniqueViolation,
  platformEnum,
  platformForArtifactType,
  resolveArtifactType,
} from './upload-inputs.js'

export function registerUploadCompletion(
  uploadRoutes: Hono<{ Variables: UploadAuthVariables }>,
) {
  uploadRoutes.post('/uploads/:id/complete', requireUploadAuth, async (c) => {
    const credential = c.get('uploadCredential')
    const session = await getSessionForUser(c.req.param('id'), c.get('user'), credential)
    if (session === null)
      return jsonError(c, 404, 'not_found', 'Upload session not found')
    if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
    if (session.status !== 'active' || session.expiresAt <= new Date()) {
      return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
    }
    const [target] = await db
      .select({ application: applications, regionCode: regions.code })
      .from(applications)
      .innerJoin(regions, eq(regions.id, applications.regionId))
      .where(eq(applications.id, session.applicationId))
      .limit(1)
    if (!target || target.application.status === 'archived') {
      return jsonError(c, 409, 'archived_application', 'Application is archived')
    }
    const app = target.application

    const parts = await db
      .select()
      .from(uploadParts)
      .where(eq(uploadParts.sessionId, session.id))
      .orderBy(asc(uploadParts.partNumber))
    const expectedNumbers = Array.from(
      { length: session.partCount },
      (_, index) => index + 1,
    )
    if (
      parts.length !== session.partCount ||
      parts.some((part, index) => part.partNumber !== expectedNumbers[index]) ||
      parts.reduce((total, part) => total + part.sizeBytes, 0) !== session.sizeBytes
    ) {
      return jsonError(c, 409, 'upload_incomplete', 'Not all upload parts are available')
    }

    let assembled: { sizeBytes: number; sha256: string }
    try {
      if (session.storageBackend === 's3') {
        if (!session.objectUploadId || parts.some((part) => !part.etag)) {
          return jsonError(
            c,
            409,
            'upload_incomplete',
            'Direct upload parts are unavailable',
          )
        }
        await completeObjectMultipartUpload(
          session.storageKey,
          session.objectUploadId,
          parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag! })),
        )
        assembled = await hashObject(session.storageKey)
      } else {
        assembled = await assembleUploadParts(
          session.storageKey,
          session.id,
          expectedNumbers,
        )
      }
    } catch {
      return jsonError(c, 409, 'upload_incomplete', 'Upload parts are unavailable')
    }
    if (assembled.sizeBytes !== session.sizeBytes) {
      if (session.storageBackend === 's3') await deleteObject(session.storageKey)
      else await deleteStorageFile(session.storageKey)
      return jsonError(c, 409, 'upload_size_mismatch', 'Final upload size mismatch')
    }

    const fields = session.fields
    const artifactType = resolveArtifactType(session.filename)
    const channel = channelEnum.parse(fields.channel)
    const platform = platformEnum.parse(fields.platform)
    const finalBuildNumber = fields.buildNumber || '1'
    const finalFilename =
      fields.distributionFilename ||
      distributionFilename({
        regionCode: target.regionCode,
        applicationCode: app.applicationCode,
        version: fields.version,
        buildNumber: finalBuildNumber,
        channel,
        originalFilename: session.filename,
      })
    const markLatest = fields.markLatest !== 'false'
    const status = markLatest
      ? 'latest'
      : channel === 'beta'
        ? 'beta'
        : channel === 'deprecated'
          ? 'deprecated'
          : 'stable'
    const isDeprecated = status === 'deprecated' || channel === 'deprecated'
    const user = c.get('user')
    const uploaderName =
      credential.kind === 'release-credential' ? credential.name : user.name
    if (
      !artifactType ||
      platform !== app.platform ||
      platform !== platformForArtifactType(artifactType)
    ) {
      if (session.storageBackend === 's3') await deleteObject(session.storageKey)
      else await deleteStorageFile(session.storageKey)
      return jsonError(c, 409, 'upload_invalid', 'Upload metadata is no longer valid')
    }

    let created: typeof artifacts.$inferSelect
    try {
      created = await db.transaction(async (tx) => {
        const now = new Date()
        const [release] = await tx
          .insert(releases)
          .values({
            applicationId: session.applicationId,
            version: fields.version,
            releaseNotes: fields.releaseNotes,
            createdById: user.sub,
            createdByName: uploaderName,
            publishedAt: now,
          })
          .onConflictDoUpdate({
            target: [releases.applicationId, releases.version],
            set: { releaseNotes: fields.releaseNotes, updatedAt: now },
          })
          .returning()
        if (markLatest) {
          await tx.execute(sql`
          UPDATE artifacts
          SET status = CASE channel
            WHEN 'beta' THEN 'beta'::artifact_status
            WHEN 'deprecated' THEN 'deprecated'::artifact_status
            ELSE 'stable'::artifact_status
          END,
          updated_at = now()
          WHERE application_id = ${session.applicationId} AND status = 'latest'
        `)
        }
        const [artifact] = await tx
          .insert(artifacts)
          .values({
            applicationId: session.applicationId,
            releaseId: release.id,
            version: fields.version,
            buildNumber: finalBuildNumber,
            platform,
            type: artifactType,
            channel,
            status,
            originalFilename: session.filename,
            filename: finalFilename,
            sizeBytes: assembled.sizeBytes,
            sha256: assembled.sha256,
            storageKey: session.storageKey,
            storageBackend: session.storageBackend,
            releaseNotes: fields.releaseNotes,
            uploaderId: user.sub,
            uploaderName,
            deprecatedAt: isDeprecated ? now : null,
          })
          .returning()
        await tx
          .update(uploadSessions)
          .set({ status: 'completed', updatedAt: now })
          .where(eq(uploadSessions.id, session.id))
        return artifact
      })
    } catch (error) {
      if (session.storageBackend === 's3') await deleteObject(session.storageKey)
      else await deleteStorageFile(session.storageKey)
      if (isUniqueViolation(error))
        return jsonError(
          c,
          409,
          'duplicate_artifact',
          'Artifact version and build already exist',
        )
      throw error
    }

    await deleteUploadSessionFiles(session.id)
    await refreshApplicationArtifactStats(session.applicationId)
    await enforceRetentionAfterUpload(session.applicationId)
    await writeAudit(c, {
      action: 'artifact.upload',
      objectType: 'artifact',
      objectId: created.id,
      applicationId: session.applicationId,
      summary: `上传 ${app.name} v${fields.version}（${finalFilename}）`,
      actorName: credential.kind === 'release-credential' ? credential.name : undefined,
      meta: {
        originalFilename: session.filename,
        filename: finalFilename,
        version: fields.version,
        channel,
        sizeBytes: assembled.sizeBytes,
        sha256: assembled.sha256,
        markLatest,
        resumable: true,
        via: credential.kind,
        ...(credential.kind === 'release-credential'
          ? {
              releaseCredentialId: credential.id,
              releaseCredentialName: credential.name,
            }
          : {}),
      },
    })
    return c.json({ artifact: mapArtifact(created) }, 201)
  })
}
