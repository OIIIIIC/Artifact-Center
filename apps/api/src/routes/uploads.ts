import { and, asc, desc, eq, gt, ilike, ne, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { Readable } from 'node:stream'
import { z } from 'zod'

import { db } from '../db/client.js'
import {
  applications,
  applicationMembers,
  artifacts,
  regions,
  releases,
  uploadParts,
  uploadSessions,
} from '../db/schema.js'
import { refreshApplicationArtifactStats } from '../lib/artifact-helpers.js'
import { distributionFilename } from '../lib/artifact-filename.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { releaseCredentialAllowsUpload } from '../lib/release-credential.js'
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
  openArtifactDownloadStream,
  saveUploadPart,
  storageKeyFor,
} from '../lib/storage.js'
import { reserveUploadCapacity } from '../lib/upload-capacity.js'
import { selectUploadStorage } from '../lib/upload-storage-selection.js'
import {
  requireUploadAuth,
  type UploadAuthVariables,
  type UploadCredential,
} from '../middleware/upload-auth.js'
import {
  hasApplicationRole,
  requireApplicationRole,
} from '../middleware/application-access.js'

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

/**
 * Applications a release credential (or an interactive MCP session) can publish to.
 * Keep the result deliberately small: it is a target picker, not the Applications UI.
 */
export const releaseApplicationQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  platform: platformEnum.optional(),
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
    originalFilename: row.originalFilename,
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

function mapReleaseApplicationTarget(row: {
  application: typeof applications.$inferSelect
  region: typeof regions.$inferSelect
  accessRole: 'admin' | 'maintainer'
}) {
  return {
    id: row.application.id,
    name: row.application.name,
    applicationCode: row.application.applicationCode,
    packageName: row.application.packageName,
    platform: row.application.platform,
    status: row.application.status,
    accessRole: row.accessRole,
    region: {
      id: row.region.id,
      code: row.region.code,
      name: row.region.name,
    },
  }
}

async function getSessionForUser(
  id: string,
  user: { sub: string; role: string },
  credential: UploadCredential,
) {
  const [session] = await db
    .select()
    .from(uploadSessions)
    .where(eq(uploadSessions.id, id))
    .limit(1)
  if (!session) return null
  const ownsSession = session.uploaderId === user.sub
  const canMaintain = await hasApplicationRole(user, session.applicationId, 'maintainer')
  if (credential.kind === 'release-credential') {
    const allowed = releaseCredentialAllowsUpload({
      channel: session.fields.channel,
      markLatest: session.fields.markLatest !== 'false',
      buildNumber: session.fields.buildNumber ?? '',
    })
    return allowed && canMaintain ? session : undefined
  }
  return ownsSession || canMaintain ? session : undefined
}

export const uploadRoutes = new Hono<{ Variables: UploadAuthVariables }>()

/**
 * Discover publish targets without granting a release credential access to the
 * broader Applications API. Only maintainers (and admins) are returned.
 */
uploadRoutes.get('/release/applications', requireUploadAuth, async (c) => {
  const parsed = releaseApplicationQuerySchema.safeParse({
    q: c.req.query('q'),
    platform: c.req.query('platform'),
  })
  if (!parsed.success) {
    return jsonError(c, 400, 'invalid_query', 'Invalid application query')
  }

  const { q, platform } = parsed.data
  const searchCondition = q
    ? (() => {
        const pattern = `%${q}%`
        return or(
          ilike(applications.name, pattern),
          // Application code and package name are the stable identifiers normally
          // found in a repository release configuration.
          ilike(applications.applicationCode, pattern),
          ilike(applications.packageName, pattern),
        )
      })()
    : undefined
  const selectableFilter = platform
    ? searchCondition
      ? and(searchCondition, eq(applications.platform, platform))
      : eq(applications.platform, platform)
    : searchCondition
  const filter = selectableFilter
    ? and(ne(applications.status, 'archived'), selectableFilter)
    : ne(applications.status, 'archived')

  const user = c.get('user')
  const rows =
    user.role === 'admin'
      ? await db
          .select({ application: applications, region: regions })
          .from(applications)
          .innerJoin(regions, eq(regions.id, applications.regionId))
          .where(filter)
          .orderBy(desc(applications.updatedAt), asc(applications.name))
          .limit(100)
      : await db
          .select({ application: applications, region: regions })
          .from(applications)
          .innerJoin(regions, eq(regions.id, applications.regionId))
          .innerJoin(
            // A release credential acts as its configured actor. Viewer access
            // can discover/download, but never expose a publish target.
            applicationMembers,
            and(
              eq(applicationMembers.applicationId, applications.id),
              eq(applicationMembers.userId, user.sub),
              eq(applicationMembers.role, 'maintainer'),
            ),
          )
          .where(filter)
          .orderBy(desc(applications.updatedAt), asc(applications.name))
          .limit(100)

  return c.json({
    items: rows.map((row) =>
      mapReleaseApplicationTarget({
        ...row,
        accessRole: user.role === 'admin' ? 'admin' : 'maintainer',
      }),
    ),
    total: rows.length,
  })
})

/** Create or recover a resumable transfer. The same resumeKey is safe to retry. */
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
uploadRoutes.put('/uploads/:id/parts/:partNumber', requireUploadAuth, async (c) => {
  const session = await getSessionForUser(
    c.req.param('id'),
    c.get('user'),
    c.get('uploadCredential'),
  )
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
uploadRoutes.post('/uploads/:id/parts/:partNumber/sign', requireUploadAuth, async (c) => {
  const session = await getSessionForUser(
    c.req.param('id'),
    c.get('user'),
    c.get('uploadCredential'),
  )
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
uploadRoutes.post(
  '/uploads/:id/parts/:partNumber/complete',
  requireUploadAuth,
  async (c) => {
    const session = await getSessionForUser(
      c.req.param('id'),
      c.get('user'),
      c.get('uploadCredential'),
    )
    if (session === null)
      return jsonError(c, 404, 'not_found', 'Upload session not found')
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
  },
)

/** Assemble persisted chunks, verify total bytes + SHA-256, then publish the artifact atomically. */
uploadRoutes.post('/uploads/:id/complete', requireUploadAuth, async (c) => {
  const credential = c.get('uploadCredential')
  const session = await getSessionForUser(c.req.param('id'), c.get('user'), credential)
  if (session === null) return jsonError(c, 404, 'not_found', 'Upload session not found')
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

/** Resolve the exact Application + Region bound to an upload credential. */
uploadRoutes.get('/release/applications/:appId/target', requireUploadAuth, async (c) => {
  const applicationId = c.req.param('appId')
  if (!(await hasApplicationRole(c.get('user'), applicationId, 'maintainer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role to publish')
  }

  const [row] = await db
    .select({
      applicationId: applications.id,
      applicationName: applications.name,
      applicationCode: applications.applicationCode,
      packageName: applications.packageName,
      platform: applications.platform,
      status: applications.status,
      regionId: regions.id,
      regionCode: regions.code,
      regionName: regions.name,
    })
    .from(applications)
    .innerJoin(regions, eq(regions.id, applications.regionId))
    .where(eq(applications.id, applicationId))
    .limit(1)
  if (!row) return jsonError(c, 404, 'not_found', 'Application not found')
  if (row.status === 'archived') {
    return jsonError(c, 409, 'archived_application', 'Application is archived')
  }

  return c.json({
    target: {
      applicationId: row.applicationId,
      applicationName: row.applicationName,
      applicationCode: row.applicationCode,
      packageName: row.packageName,
      platform: row.platform,
      status: row.status,
      region: {
        id: row.regionId,
        code: row.regionCode,
        name: row.regionName,
      },
    },
  })
})

/** Confirm that a published artifact is readable without exposing a download URL. */
uploadRoutes.get('/release/artifacts/:id/verify', requireUploadAuth, async (c) => {
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, c.req.param('id')))
    .limit(1)
  if (!artifact) return jsonError(c, 404, 'not_found', 'Artifact not found')

  const credential = c.get('uploadCredential')
  if (
    credential.kind === 'release-credential' &&
    artifact.channel !== 'beta' &&
    artifact.channel !== 'stable'
  ) {
    return jsonError(
      c,
      403,
      'release_credential_scope',
      'Artifact is outside credential scope',
    )
  }
  if (!(await hasApplicationRole(c.get('user'), artifact.applicationId, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  const stream = await openArtifactDownloadStream(
    artifact.storageKey,
    artifact.storageBackend,
  )
  if (!stream) return jsonError(c, 409, 'file_missing', 'Artifact file is unavailable')
  stream.destroy()
  const [target] = await db
    .select({
      applicationName: applications.name,
      platform: applications.platform,
      regionCode: regions.code,
      regionName: regions.name,
    })
    .from(applications)
    .innerJoin(regions, eq(regions.id, applications.regionId))
    .where(eq(applications.id, artifact.applicationId))
    .limit(1)
  if (!target) {
    return jsonError(c, 409, 'target_missing', 'Artifact target is unavailable')
  }
  return c.json({
    available: true,
    artifact: mapArtifact(artifact),
    target: {
      applicationId: artifact.applicationId,
      applicationName: target.applicationName,
      platform: target.platform,
      region: { code: target.regionCode, name: target.regionName },
    },
    pagePath: `/applications/${artifact.applicationId}`,
    verifiedAt: new Date().toISOString(),
  })
})

uploadRoutes.delete('/uploads/:id', requireUploadAuth, async (c) => {
  const session = await getSessionForUser(
    c.req.param('id'),
    c.get('user'),
    c.get('uploadCredential'),
  )
  if (session === null) return jsonError(c, 404, 'not_found', 'Upload session not found')
  if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  await db.delete(uploadSessions).where(eq(uploadSessions.id, session.id))
  if (session.storageBackend === 's3' && session.objectUploadId) {
    await abortObjectMultipartUpload(session.storageKey, session.objectUploadId)
  }
  await deleteUploadSessionFiles(session.id)
  return c.json({ ok: true })
})
