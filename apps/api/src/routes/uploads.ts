import { and, asc, eq, gt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { Readable } from 'node:stream'
import { z } from 'zod'

import { db } from '../db/client.js'
import {
  applications,
  artifacts,
  releases,
  uploadParts,
  uploadSessions,
} from '../db/schema.js'
import { refreshApplicationArtifactStats } from '../lib/artifact-helpers.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { enforceRetentionAfterUpload } from '../lib/retention.js'
import {
  abortObjectMultipartUpload,
  completeObjectMultipartUpload,
  createObjectMultipartUpload,
  deleteObject,
  hashObject,
  objectStorageEnabled,
  objectStorageKeyFor,
  signObjectUploadPart,
} from '../lib/object-storage.js'
import {
  assembleUploadParts,
  deleteStorageFile,
  deleteUploadSessionFiles,
  saveUploadPart,
  storageKeyFor,
} from '../lib/storage.js'
import { reserveUploadCapacity } from '../lib/upload-capacity.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import {
  hasApplicationRole,
  requireApplicationRole,
} from '../middleware/application-access.js'
import { requireMinRole } from '../middleware/require-role.js'

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024
const PART_SIZE_BYTES = 8 * 1024 * 1024
const MAX_PART_COUNT = Math.ceil(MAX_UPLOAD_BYTES / PART_SIZE_BYTES)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

const platformEnum = z.enum(['android', 'windows', 'zip'])
const channelEnum = z.enum(['stable', 'beta', 'internal', 'deprecated'])
const createUploadSchema = z.object({
  resumeKey: z.string().min(12).max(160),
  filename: z.string().min(1).max(500),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  version: z.string().trim().min(1).max(64),
  buildNumber: z.string().trim().max(64).optional().default(''),
  platform: platformEnum,
  channel: channelEnum.optional().default('stable'),
  releaseNotes: z.string().max(8000).optional().default(''),
  markLatest: z.boolean().optional().default(true),
})

type ArtifactType = 'apk' | 'aab' | 'exe' | 'zip'

function resolveArtifactType(filename: string): ArtifactType | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'apk' || ext === 'aab' || ext === 'exe' || ext === 'zip') return ext
  if (ext === 'msi') return 'exe'
  return null
}

function platformForArtifactType(type: ArtifactType) {
  if (type === 'apk' || type === 'aab') return 'android' as const
  if (type === 'exe') return 'windows' as const
  return 'zip' as const
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

function fieldsFromInput(
  input: z.infer<typeof createUploadSchema>,
): Record<string, string> {
  return {
    version: input.version,
    buildNumber: input.buildNumber,
    platform: input.platform,
    channel: input.channel,
    releaseNotes: input.releaseNotes,
    markLatest: input.markLatest ? 'true' : 'false',
  }
}

function mapSession(session: typeof uploadSessions.$inferSelect, parts: number[]) {
  return {
    uploadId: session.id,
    partSize: session.partSize,
    partCount: session.partCount,
    uploadedParts: parts,
    transport: session.storageBackend === 's3' ? 'direct' : 'proxy',
    expiresAt: session.expiresAt.toISOString(),
  }
}

const directPartSchema = z.object({
  etag: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive(),
})

function mapArtifact(row: typeof artifacts.$inferSelect) {
  return {
    id: row.id,
    applicationId: row.applicationId,
    releaseId: row.releaseId,
    version: row.version,
    buildNumber: row.buildNumber,
    platform: row.platform,
    type: row.type,
    channel: row.channel,
    status: row.status,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    releaseNotes: row.releaseNotes,
    uploader: row.uploaderName,
    uploadedAt: row.uploadedAt.toISOString(),
    parsedMeta: row.parsedMeta,
    buildMeta: row.buildMeta,
  }
}

async function getSessionForUser(id: string, user: { sub: string; role: string }) {
  const [session] = await db
    .select()
    .from(uploadSessions)
    .where(eq(uploadSessions.id, id))
    .limit(1)
  if (!session) return null
  const ownsSession = session.uploaderId === user.sub
  const canMaintain = await hasApplicationRole(user, session.applicationId, 'maintainer')
  return ownsSession || canMaintain ? session : undefined
}

export const uploadRoutes = new Hono<{ Variables: AuthVariables }>()

/** Create or recover a resumable transfer. The same resumeKey is safe to retry. */
uploadRoutes.post(
  '/applications/:appId/uploads',
  requireAuth,
  requireMinRole('maintainer'),
  requireApplicationRole('appId', 'maintainer'),
  async (c) => {
    const input = createUploadSchema.safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return jsonError(c, 400, 'invalid_body', 'Invalid upload metadata')

    const appId = c.req.param('appId')
    const user = c.get('user')
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appId))
      .limit(1)
    if (!app) return jsonError(c, 404, 'not_found', 'Application not found')
    if (app.status === 'archived') {
      return jsonError(c, 409, 'archived_application', 'Application is archived')
    }

    const artifactType = resolveArtifactType(input.data.filename)
    if (!artifactType)
      return jsonError(c, 400, 'unsupported_file_type', 'Unsupported artifact file type')
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

    const storageBackend = objectStorageEnabled() ? 's3' : 'local'
    const storageKey =
      storageBackend === 's3'
        ? objectStorageKeyFor(appId, input.data.filename)
        : storageKeyFor(appId, input.data.filename)
    let objectUploadId: string | null = null
    try {
      if (storageBackend === 's3') {
        objectUploadId = await createObjectMultipartUpload(
          storageKey,
          input.data.filename,
        )
      }
    } catch {
      return jsonError(
        c,
        503,
        'object_storage_unavailable',
        'Object storage is unavailable',
      )
    }

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
          fields: fieldsFromInput(input.data),
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

uploadRoutes.get('/uploads/:id', requireAuth, async (c) => {
  const session = await getSessionForUser(c.req.param('id'), c.get('user'))
  if (session === null) return jsonError(c, 404, 'not_found', 'Upload session not found')
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

/** Upload or retry exactly one chunk. A chunk is stored atomically and can be retried safely. */
uploadRoutes.put('/uploads/:id/parts/:partNumber', requireAuth, async (c) => {
  const session = await getSessionForUser(c.req.param('id'), c.get('user'))
  if (session === null) return jsonError(c, 404, 'not_found', 'Upload session not found')
  if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  if (session.status !== 'active' || session.expiresAt <= new Date()) {
    return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
  }
  if (session.storageBackend === 's3') {
    return jsonError(c, 409, 'direct_upload_required', 'Use direct object storage upload')
  }

  const partNumber = Number(c.req.param('partNumber'))
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > session.partCount) {
    return jsonError(c, 400, 'invalid_part', 'Invalid upload part number')
  }
  const expectedSize = Math.min(
    session.partSize,
    session.sizeBytes - (partNumber - 1) * session.partSize,
  )
  const contentLength = Number(c.req.header('content-length'))
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > expectedSize
  ) {
    return jsonError(c, 400, 'invalid_part_size', 'Invalid upload part size')
  }
  if (!c.req.raw.body)
    return jsonError(c, 400, 'file_required', 'Upload part is required')

  const capacity = await reserveUploadCapacity(contentLength)
  if (!capacity.accepted) {
    const message =
      capacity.reason === 'storage_quota_exceeded'
        ? 'Storage quota exceeded'
        : 'Insufficient disk space'
    return jsonError(c, 507, capacity.reason, message)
  }
  try {
    const saved = await saveUploadPart(
      session.id,
      partNumber,
      Readable.fromWeb(c.req.raw.body),
    )
    if (saved.sizeBytes !== contentLength) {
      return jsonError(c, 400, 'invalid_part_size', 'Upload part size mismatch')
    }
    await db
      .insert(uploadParts)
      .values({
        sessionId: session.id,
        partNumber,
        sizeBytes: saved.sizeBytes,
        sha256: saved.sha256,
      })
      .onConflictDoUpdate({
        target: [uploadParts.sessionId, uploadParts.partNumber],
        set: { sizeBytes: saved.sizeBytes, sha256: saved.sha256, createdAt: new Date() },
      })
    return c.json({ part: { number: partNumber, sizeBytes: saved.sizeBytes } }, 201)
  } finally {
    capacity.release()
  }
})

/** Short-lived URL for a browser-direct S3/MinIO part upload. */
uploadRoutes.post('/uploads/:id/parts/:partNumber/sign', requireAuth, async (c) => {
  const session = await getSessionForUser(c.req.param('id'), c.get('user'))
  if (session === null) return jsonError(c, 404, 'not_found', 'Upload session not found')
  if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  if (session.status !== 'active' || session.expiresAt <= new Date()) {
    return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
  }
  const partNumber = Number(c.req.param('partNumber'))
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > session.partCount) {
    return jsonError(c, 400, 'invalid_part', 'Invalid upload part number')
  }
  if (session.storageBackend !== 's3' || !session.objectUploadId) {
    return jsonError(c, 409, 'direct_upload_unavailable', 'Direct upload is unavailable')
  }
  try {
    const url = await signObjectUploadPart(
      session.storageKey,
      session.objectUploadId,
      partNumber,
    )
    return c.json({ url })
  } catch {
    return jsonError(
      c,
      503,
      'object_storage_unavailable',
      'Object storage is unavailable',
    )
  }
})

/** Record a browser-direct part after S3/MinIO has returned its ETag. */
uploadRoutes.post('/uploads/:id/parts/:partNumber/complete', requireAuth, async (c) => {
  const session = await getSessionForUser(c.req.param('id'), c.get('user'))
  if (session === null) return jsonError(c, 404, 'not_found', 'Upload session not found')
  if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  if (
    session.storageBackend !== 's3' ||
    session.status !== 'active' ||
    session.expiresAt <= new Date()
  ) {
    return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
  }
  const partNumber = Number(c.req.param('partNumber'))
  const input = directPartSchema.safeParse(await c.req.json().catch(() => null))
  const expectedSize = Math.min(
    session.partSize,
    session.sizeBytes - (partNumber - 1) * session.partSize,
  )
  if (
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > session.partCount ||
    !input.success ||
    input.data.sizeBytes !== expectedSize
  ) {
    return jsonError(c, 400, 'invalid_part', 'Invalid direct upload part')
  }
  await db
    .insert(uploadParts)
    .values({
      sessionId: session.id,
      partNumber,
      sizeBytes: input.data.sizeBytes,
      sha256: '',
      etag: input.data.etag,
    })
    .onConflictDoUpdate({
      target: [uploadParts.sessionId, uploadParts.partNumber],
      set: {
        sizeBytes: input.data.sizeBytes,
        sha256: '',
        etag: input.data.etag,
        createdAt: new Date(),
      },
    })
  return c.json({ part: { number: partNumber, sizeBytes: input.data.sizeBytes } }, 201)
})

/** Assemble persisted chunks, verify total bytes + SHA-256, then publish the artifact atomically. */
uploadRoutes.post('/uploads/:id/complete', requireAuth, async (c) => {
  const session = await getSessionForUser(c.req.param('id'), c.get('user'))
  if (session === null) return jsonError(c, 404, 'not_found', 'Upload session not found')
  if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  if (session.status !== 'active' || session.expiresAt <= new Date()) {
    return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
  }
  const [app] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, session.applicationId))
    .limit(1)
  if (!app || app.status === 'archived') {
    return jsonError(c, 409, 'archived_application', 'Application is archived')
  }

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
  if (!artifactType) {
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
          createdByName: user.name,
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
          buildNumber: fields.buildNumber || '1',
          platform,
          type: artifactType,
          channel,
          status,
          filename: session.filename,
          sizeBytes: assembled.sizeBytes,
          sha256: assembled.sha256,
          storageKey: session.storageKey,
          storageBackend: session.storageBackend,
          releaseNotes: fields.releaseNotes,
          uploaderId: user.sub,
          uploaderName: user.name,
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
    summary: `上传 ${app.name} v${fields.version}（${session.filename}）`,
    meta: {
      version: fields.version,
      channel,
      sizeBytes: assembled.sizeBytes,
      sha256: assembled.sha256,
      markLatest,
      resumable: true,
    },
  })
  return c.json({ artifact: mapArtifact(created) }, 201)
})

uploadRoutes.delete('/uploads/:id', requireAuth, async (c) => {
  const session = await getSessionForUser(c.req.param('id'), c.get('user'))
  if (session === null) return jsonError(c, 404, 'not_found', 'Upload session not found')
  if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  await db.delete(uploadSessions).where(eq(uploadSessions.id, session.id))
  if (session.storageBackend === 's3' && session.objectUploadId) {
    await abortObjectMultipartUpload(session.storageKey, session.objectUploadId)
  }
  await deleteUploadSessionFiles(session.id)
  return c.json({ ok: true })
})
