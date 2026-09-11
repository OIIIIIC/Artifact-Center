import { and, asc, eq, gt } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import { applications, regions, uploadParts, uploadSessions } from '../db/schema.js'
import { distributionFilename } from '../lib/artifact-filename.js'
import { jsonError } from '../lib/errors.js'
import {
  abortObjectMultipartUpload,
  createObjectMultipartUpload,
  objectStorageEnabled,
  objectStorageKeyFor,
} from '../lib/object-storage.js'
import { releaseCredentialAllowsUpload } from '../lib/release-credential.js'
import { storageKeyFor } from '../lib/storage.js'
import { selectUploadStorage } from '../lib/upload-storage-selection.js'
import { requireApplicationRole } from '../middleware/application-access.js'
import { requireUploadAuth, type UploadAuthVariables } from '../middleware/upload-auth.js'
import {
  MAX_PART_COUNT,
  PART_SIZE_BYTES,
  SESSION_TTL_MS,
  createUploadSchema,
  fieldsFromInput,
  getSessionForUser,
  mapSession,
  platformForArtifactType,
  resolveArtifactType,
} from './upload-inputs.js'

export function registerUploadSessions(
  uploadRoutes: Hono<{ Variables: UploadAuthVariables }>,
) {
  uploadRoutes.post(
    '/applications/:appId/uploads',
    requireUploadAuth,
    requireApplicationRole('appId', 'maintainer'),
    async (c) => {
      const input = createUploadSchema.safeParse(await c.req.json().catch(() => null))
      if (!input.success)
        return jsonError(c, 400, 'invalid_body', 'Invalid upload metadata')

      const appId = c.req.param('appId')
      const user = c.get('user')
      const credential = c.get('uploadCredential')
      if (
        credential.kind === 'release-credential' &&
        !releaseCredentialAllowsUpload({
          channel: input.data.channel,
          markLatest: input.data.markLatest,
          buildNumber: input.data.buildNumber,
        })
      ) {
        return jsonError(
          c,
          403,
          'release_credential_scope',
          'Release credential requires a build number, permits beta without replacing latest, and permits stable releases',
        )
      }
      const [target] = await db
        .select({ application: applications, regionCode: regions.code })
        .from(applications)
        .innerJoin(regions, eq(regions.id, applications.regionId))
        .where(eq(applications.id, appId))
        .limit(1)
      if (!target) return jsonError(c, 404, 'not_found', 'Application not found')
      const app = target.application
      if (app.status === 'archived') {
        return jsonError(c, 409, 'archived_application', 'Application is archived')
      }

      const artifactType = resolveArtifactType(input.data.filename)
      if (!artifactType)
        return jsonError(
          c,
          400,
          'unsupported_file_type',
          'Unsupported artifact file type',
        )
      if (
        input.data.platform !== platformForArtifactType(artifactType) ||
        input.data.platform !== app.platform
      ) {
        return jsonError(
          c,
          400,
          'platform_mismatch',
          'File type does not match application platform',
        )
      }

      const now = new Date()
      const [existing] = await db
        .select()
        .from(uploadSessions)
        .where(
          and(
            eq(uploadSessions.applicationId, appId),
            eq(uploadSessions.uploaderId, user.sub),
            eq(uploadSessions.resumeKey, input.data.resumeKey),
            eq(uploadSessions.status, 'active'),
            gt(uploadSessions.expiresAt, now),
          ),
        )
        .limit(1)

      if (
        existing &&
        existing.filename === input.data.filename &&
        existing.sizeBytes === input.data.sizeBytes
      ) {
        const parts = await db
          .select({ partNumber: uploadParts.partNumber })
          .from(uploadParts)
          .where(eq(uploadParts.sessionId, existing.id))
          .orderBy(asc(uploadParts.partNumber))
        return c.json({
          upload: mapSession(
            existing,
            parts.map((part) => part.partNumber),
          ),
        })
      }

      const partCount = Math.ceil(input.data.sizeBytes / PART_SIZE_BYTES)
      if (partCount > MAX_PART_COUNT)
        return jsonError(c, 400, 'too_large', 'Too many upload parts')

      const finalFilename = distributionFilename({
        regionCode: target.regionCode,
        applicationCode: app.applicationCode,
        version: input.data.version,
        buildNumber: input.data.buildNumber || '1',
        channel: input.data.channel,
        originalFilename: input.data.filename,
      })
      const directStorageKey = objectStorageKeyFor(appId, input.data.filename)
      const { storageBackend, storageKey, objectUploadId } = await selectUploadStorage({
        objectStorageEnabled: objectStorageEnabled(),
        localStorageKey: storageKeyFor(appId, input.data.filename),
        objectStorageKey: directStorageKey,
        createObjectMultipartUpload: () =>
          createObjectMultipartUpload(directStorageKey, finalFilename),
        onDirectUploadUnavailable: (error) => {
          const detail = error instanceof Error ? error : new Error(String(error))
          console.warn(
            '[upload-storage] direct multipart initialization failed; using proxy fallback',
            {
              applicationId: appId,
              errorCode:
                typeof error === 'object' && error !== null && 'Code' in error
                  ? String(error.Code)
                  : undefined,
              errorMessage: detail.message,
              errorName: detail.name,
            },
          )
        },
      })

      let session: typeof uploadSessions.$inferSelect
      try {
        const [created] = await db
          .insert(uploadSessions)
          .values({
            applicationId: appId,
            uploaderId: user.sub,
            resumeKey: input.data.resumeKey,
            filename: input.data.filename,
            sizeBytes: input.data.sizeBytes,
            fields: {
              ...fieldsFromInput(input.data),
              distributionFilename: finalFilename,
            },
            storageKey,
            storageBackend,
            objectUploadId,
            partSize: PART_SIZE_BYTES,
            partCount,
            expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
          })
          .returning()
        session = created!
      } catch (error) {
        if (objectUploadId) await abortObjectMultipartUpload(storageKey, objectUploadId)
        throw error
      }
      return c.json({ upload: mapSession(session, []) }, 201)
    },
  )

  uploadRoutes.get('/uploads/:id', requireUploadAuth, async (c) => {
    const session = await getSessionForUser(
      c.req.param('id'),
      c.get('user'),
      c.get('uploadCredential'),
    )
    if (session === null)
      return jsonError(c, 404, 'not_found', 'Upload session not found')
    if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
    if (session.status !== 'active' || session.expiresAt <= new Date()) {
      return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
    }
    const parts = await db
      .select({ partNumber: uploadParts.partNumber })
      .from(uploadParts)
      .where(eq(uploadParts.sessionId, session.id))
      .orderBy(asc(uploadParts.partNumber))
    return c.json({
      upload: mapSession(
        session,
        parts.map((part) => part.partNumber),
      ),
    })
  })
}
