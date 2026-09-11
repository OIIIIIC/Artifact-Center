import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { mapArtifact } from '../lib/artifact-response.js'

import { db } from '../db/client.js'
import { applications, artifacts, regions, releases } from '../db/schema.js'
import { distributionFilename } from '../lib/artifact-filename.js'
import {
  refreshApplicationArtifactStats,
  statusFromChannel,
} from '../lib/artifact-helpers.js'
import { writeAudit } from '../lib/audit.js'
import { attachmentDisposition } from '../lib/download-response.js'
import { jsonError } from '../lib/errors.js'
import {
  signDownloadTicket,
  verifyDownloadTicket,
  type DownloadTicketPayload,
} from '../lib/jwt.js'
import { MultipartUploadError, streamMultipartForm } from '../lib/multipart-upload.js'
import { enforceRetentionAfterUpload } from '../lib/retention.js'
import {
  deleteArtifactStorageFile,
  deleteStorageFile,
  ensureStorageRoot,
  openArtifactDownloadStream,
  saveUploadStream,
  storageKeyFor,
} from '../lib/storage.js'
import { reserveUploadCapacity } from '../lib/upload-capacity.js'
import {
  hasApplicationRole,
  requireApplicationRole,
} from '../middleware/application-access.js'
import {
  requireAuth,
  validateCurrentAuthUser,
  type AuthVariables,
} from '../middleware/auth.js'

/** Max artifact size — keep in sync with frontend UPLOAD_MAX_BYTES */
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024 // 512 MB
/** Multipart boundary and release metadata have a small envelope beyond the file bytes. */
const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024

const channelEnum = z.enum(['stable', 'beta', 'internal', 'deprecated'])
const platformEnum = z.enum(['android', 'windows', 'zip'])
const statusEnum = z.enum(['latest', 'stable', 'beta', 'deprecated', 'archived'])
type ArtifactType = 'apk' | 'aab' | 'exe' | 'zip'

const patchSchema = z.object({
  channel: channelEnum.optional(),
  status: statusEnum.optional(),
  releaseNotes: z.string().max(8000).optional(),
  /** Shorthand: promote this row to latest (demotes previous) */
  markLatest: z.boolean().optional(),
})

async function findArtifactForDownload(id: string) {
  const [row] = await db
    .select({ artifact: artifacts, applicationName: applications.name })
    .from(artifacts)
    .innerJoin(applications, eq(artifacts.applicationId, applications.id))
    .where(eq(artifacts.id, id))
    .limit(1)

  return row ? { ...row.artifact, applicationName: row.applicationName } : undefined
}

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

export const artifactRoutes = new Hono<{ Variables: AuthVariables }>()

/** POST /applications/:appId/artifacts — multipart upload */
artifactRoutes.post(
  '/applications/:appId/artifacts',
  requireAuth,
  requireApplicationRole('appId', 'maintainer'),
  async (c) => {
    const appId = c.req.param('appId')
    const user = c.get('user')

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

    let releaseCapacity: (() => void) | null = null
    const releaseReservedCapacity = () => {
      releaseCapacity?.()
      releaseCapacity = null
    }
    const contentLengthHeader = c.req.header('content-length')
    const contentLength =
      contentLengthHeader === undefined ? undefined : Number(contentLengthHeader)
    if (
      contentLength !== undefined &&
      (!Number.isSafeInteger(contentLength) || contentLength < 1)
    ) {
      return jsonError(c, 400, 'invalid_content_length', 'Invalid Content-Length')
    }
    if (
      contentLength !== undefined &&
      contentLength > MAX_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
    ) {
      return jsonError(c, 400, 'too_large', `Max size is ${MAX_UPLOAD_BYTES} bytes`)
    }
    if (contentLength !== undefined) {
      const reservation = await reserveUploadCapacity(contentLength)
      if (!reservation.accepted) {
        const message =
          reservation.reason === 'storage_quota_exceeded'
            ? 'Storage quota exceeded'
            : reservation.reason === 'storage_low_disk'
              ? 'Insufficient disk space'
              : 'Storage capacity is unavailable'
        return jsonError(c, 507, reservation.reason, message)
      }
      releaseCapacity = reservation.release
    }

    let storageKey = ''
    let uploadedFile: {
      filename: string
      type: ArtifactType | null
      sizeBytes: number
      sha256: string
    } | null = null
    const discardUpload = async () => {
      if (!storageKey) return
      await deleteStorageFile(storageKey)
      storageKey = ''
    }
    const rejectUpload = async (status: number, code: string, message: string) => {
      releaseReservedCapacity()
      await discardUpload()
      return jsonError(c, status, code, message)
    }

    let body: Record<string, string>
    try {
      body = await streamMultipartForm(c.req.raw, {
        limits: {
          files: 1,
          fields: 12,
          fieldNameSize: 100,
          fieldSize: 8 * 1024,
          fileSize: MAX_UPLOAD_BYTES,
        },
        onFile: async ({ fieldName, filename, stream }) => {
          if (fieldName !== 'file') {
            stream.resume()
            throw new MultipartUploadError('file_required')
          }

          const type = resolveArtifactType(filename)
          if (!type) {
            uploadedFile = { filename, type: null, sizeBytes: 0, sha256: '' }
            stream.resume()
            return
          }

          ensureStorageRoot()
          storageKey = storageKeyFor(appId, filename)
          const saved = await saveUploadStream(storageKey, stream)
          uploadedFile = { filename, type, ...saved }
        },
      })
    } catch (error) {
      releaseReservedCapacity()
      await discardUpload()
      if (error instanceof MultipartUploadError) {
        const message =
          error.code === 'file_too_large'
            ? `Max size is ${MAX_UPLOAD_BYTES} bytes`
            : error.code === 'file_required'
              ? 'Multipart field "file" is required'
              : error.code === 'multiple_files'
                ? 'Only one artifact file can be uploaded at a time'
                : 'Invalid multipart upload'
        return jsonError(c, 400, error.code, message)
      }
      throw error
    }

    // Assignments from multipart callbacks are intentionally opaque to TypeScript's
    // control-flow analysis; re-read the completed upload after the parser settles.
    const file = uploadedFile as {
      filename: string
      type: ArtifactType | null
      sizeBytes: number
      sha256: string
    } | null
    if (!file) {
      return rejectUpload(400, 'file_required', 'Multipart field "file" is required')
    }
    if (file.sizeBytes <= 0) {
      return rejectUpload(400, 'empty_file', 'Empty file')
    }
    if (!file.type) {
      return rejectUpload(400, 'unsupported_file_type', 'Unsupported artifact file type')
    }

    const { filename, type: artifactType, sizeBytes, sha256 } = file
    const version = String(body.version ?? '').trim()
    const buildNumber = String(body.buildNumber ?? '').trim()
    const releaseNotes = String(body.releaseNotes ?? '').trim()
    const markLatest = String(body.markLatest ?? 'true') !== 'false'
    const channelParsed = channelEnum.safeParse(String(body.channel ?? 'stable'))
    const platformParsed = platformEnum.safeParse(String(body.platform ?? app.platform))

    if (!version) {
      return rejectUpload(400, 'invalid_body', 'version is required')
    }
    if (!channelParsed.success || !platformParsed.success) {
      return rejectUpload(400, 'invalid_body', 'Invalid channel or platform')
    }

    const platform = platformParsed.data
    if (platform !== platformForArtifactType(artifactType)) {
      return rejectUpload(
        400,
        'platform_mismatch',
        'File type does not match application platform',
      )
    }
    if (platform !== app.platform) {
      return rejectUpload(
        400,
        'platform_mismatch',
        'File type does not match application platform',
      )
    }

    if (!releaseCapacity) {
      const reservation = await reserveUploadCapacity(sizeBytes)
      if (!reservation.accepted) {
        const message =
          reservation.reason === 'storage_quota_exceeded'
            ? 'Storage quota exceeded'
            : reservation.reason === 'storage_low_disk'
              ? 'Insufficient disk space'
              : 'Storage capacity is unavailable'
        return rejectUpload(507, reservation.reason, message)
      }
      releaseCapacity = reservation.release
    }

    const channel = channelParsed.data
    const finalBuildNumber = buildNumber || '1'
    const finalFilename = distributionFilename({
      regionCode: target.regionCode,
      applicationCode: app.applicationCode,
      version,
      buildNumber: finalBuildNumber,
      channel,
      originalFilename: filename,
    })
    const status = markLatest
      ? ('latest' as const)
      : channel === 'beta'
        ? ('beta' as const)
        : channel === 'deprecated'
          ? ('deprecated' as const)
          : ('stable' as const)

    const isDeprecated = status === 'deprecated' || channel === 'deprecated'
    let row: typeof artifacts.$inferSelect
    try {
      row = await db.transaction(async (tx) => {
        const now = new Date()
        const [release] = await tx
          .insert(releases)
          .values({
            applicationId: appId,
            version,
            releaseNotes,
            createdById: user.sub,
            createdByName: user.name,
            publishedAt: now,
          })
          .onConflictDoUpdate({
            target: [releases.applicationId, releases.version],
            set: { releaseNotes, updatedAt: now },
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
          WHERE application_id = ${appId} AND status = 'latest'
          `)
        }

        const [created] = await tx
          .insert(artifacts)
          .values({
            applicationId: appId,
            releaseId: release.id,
            version,
            buildNumber: finalBuildNumber,
            platform,
            type: artifactType,
            channel,
            status,
            originalFilename: filename,
            filename: finalFilename,
            sizeBytes,
            sha256,
            storageKey,
            releaseNotes,
            uploaderId: user.sub,
            uploaderName: user.name,
            deprecatedAt: isDeprecated ? now : null,
          })
          .returning()

        if (app.status === 'new') {
          await tx
            .update(applications)
            .set({ status: 'active', updatedAt: now })
            .where(eq(applications.id, appId))
        }

        return created
      })
    } catch (error) {
      releaseReservedCapacity()
      await deleteStorageFile(storageKey)
      if (isUniqueViolation(error)) {
        return jsonError(
          c,
          409,
          'duplicate_artifact',
          'Artifact version and build already exist',
        )
      }
      throw error
    }

    releaseReservedCapacity()

    // Enforce max-versions after upload
    await enforceRetentionAfterUpload(appId)

    await writeAudit(c, {
      action: 'artifact.upload',
      objectType: 'artifact',
      objectId: row.id,
      applicationId: appId,
      summary: `上传 ${app.name} v${version}（${finalFilename}）`,
      meta: {
        originalFilename: file.filename,
        filename: finalFilename,
        version,
        channel,
        sizeBytes,
        sha256,
        markLatest,
      },
    })

    // Re-fetch in case retention deleted this or demoted others
    const [fresh] = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, row.id))
      .limit(1)

    return c.json({ artifact: mapArtifact(fresh ?? row) }, 201)
  },
)

/** GET /artifacts/:id — metadata */
artifactRoutes.get('/artifacts/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  const [row] = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1)
  if (!row) return jsonError(c, 404, 'not_found', 'Artifact not found')
  if (!(await hasApplicationRole(c.get('user'), row.applicationId, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }
  return c.json({ artifact: mapArtifact(row) })
})

/** GET /artifacts/:id/download — stream file */
artifactRoutes.get('/artifacts/:id/download', requireAuth, async (c) => {
  const id = c.req.param('id')
  const row = await findArtifactForDownload(id)
  if (!row) return jsonError(c, 404, 'not_found', 'Artifact not found')
  if (!(await hasApplicationRole(c.get('user'), row.applicationId, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  const stream = await openArtifactDownloadStream(row.storageKey, row.storageBackend)
  if (!stream) {
    return jsonError(c, 404, 'file_missing', 'File missing from storage')
  }

  c.header('Content-Disposition', attachmentDisposition(row.filename))
  c.header('Content-Type', 'application/octet-stream')
  c.header('Content-Length', String(row.sizeBytes))

  void writeAudit(c, {
    action: 'artifact.download',
    objectType: 'artifact',
    objectId: row.id,
    applicationId: row.applicationId,
    summary: `下载 ${row.applicationName} · ${row.filename}（v${row.version}）`,
    meta: {
      applicationName: row.applicationName,
      version: row.version,
      sizeBytes: row.sizeBytes,
    },
  })

  return c.body(Readable.toWeb(stream) as ReadableStream)
})

/** POST /artifacts/:id/download-ticket — issue a short-lived native-download URL. */
artifactRoutes.post('/artifacts/:id/download-ticket', requireAuth, async (c) => {
  const id = c.req.param('id')
  const [row] = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1)
  if (!row) return jsonError(c, 404, 'not_found', 'Artifact not found')

  const user = c.get('user')
  if (!(await hasApplicationRole(user, row.applicationId, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  const ticket = await signDownloadTicket({ ...user, artifactId: row.id })
  return c.json({ url: `/downloads/${ticket}` })
})

/** GET /downloads/:ticket — browser-native streaming download with a short-lived ticket. */
artifactRoutes.get('/downloads/:ticket', async (c) => {
  let ticket: DownloadTicketPayload
  try {
    ticket = await verifyDownloadTicket(c.req.param('ticket'))
    const currentTicketUser = await validateCurrentAuthUser(ticket)
    if (!currentTicketUser) throw new Error('revoked_ticket')
    ticket = currentTicketUser
  } catch {
    return jsonError(c, 401, 'unauthorized', 'Invalid or expired download ticket')
  }

  const row = await findArtifactForDownload(ticket.artifactId)
  if (!row) return jsonError(c, 404, 'not_found', 'Artifact not found')
  if (!(await hasApplicationRole(ticket, row.applicationId, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  const stream = await openArtifactDownloadStream(row.storageKey, row.storageBackend)
  if (!stream) return jsonError(c, 404, 'file_missing', 'File missing from storage')

  c.header('Content-Disposition', attachmentDisposition(row.filename))
  c.header('Content-Type', 'application/octet-stream')
  c.header('Content-Length', String(row.sizeBytes))

  void writeAudit(c, {
    action: 'artifact.download',
    objectType: 'artifact',
    objectId: row.id,
    applicationId: row.applicationId,
    summary: `下载 ${row.applicationName} · ${row.filename}（v${row.version}）`,
    meta: {
      applicationName: row.applicationName,
      version: row.version,
      sizeBytes: row.sizeBytes,
      via: 'download_ticket',
    },
    actorId: ticket.sub,
    actorName: ticket.name,
  })

  return c.body(Readable.toWeb(stream) as ReadableStream)
})

/** PATCH /artifacts/:id — channel / status / notes / mark latest */
artifactRoutes.patch('/artifacts/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid update payload',
      parsed.error.flatten(),
    )
  }

  const [current] = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'Artifact not found')
  if (!(await hasApplicationRole(c.get('user'), current.applicationId, 'maintainer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }
  const [currentApp] = await db
    .select({ status: applications.status })
    .from(applications)
    .where(eq(applications.id, current.applicationId))
    .limit(1)
  if (currentApp?.status === 'archived') {
    return jsonError(c, 409, 'archived_application', 'Application is archived')
  }

  const data = parsed.data
  if (
    data.channel === undefined &&
    data.status === undefined &&
    data.releaseNotes === undefined &&
    data.markLatest === undefined
  ) {
    return jsonError(c, 400, 'invalid_body', 'No fields to update')
  }

  const nextChannel = data.channel ?? current.channel
  let nextStatus = current.status

  if (data.markLatest === true || data.status === 'latest') {
    nextStatus = 'latest'
  } else if (data.status !== undefined) {
    nextStatus = data.status
  } else if (data.channel !== undefined && current.status !== 'latest') {
    // Channel change adjusts baseline status unless still "latest"
    nextStatus = statusFromChannel(nextChannel)
  }

  const wasDeprecated =
    current.status === 'deprecated' || current.channel === 'deprecated'
  const willBeDeprecated = nextStatus === 'deprecated' || nextChannel === 'deprecated'
  let deprecatedAt = current.deprecatedAt
  if (willBeDeprecated && !wasDeprecated) {
    deprecatedAt = new Date()
  } else if (!willBeDeprecated && wasDeprecated) {
    deprecatedAt = null
  }

  const row = await db.transaction(async (tx) => {
    const now = new Date()
    if (data.markLatest === true || data.status === 'latest') {
      await tx.execute(sql`
          UPDATE artifacts
          SET status = CASE channel
            WHEN 'beta' THEN 'beta'::artifact_status
            WHEN 'deprecated' THEN 'deprecated'::artifact_status
            ELSE 'stable'::artifact_status
          END,
          updated_at = now()
          WHERE application_id = ${current.applicationId} AND status = 'latest'
        `)
    }

    if (data.releaseNotes !== undefined) {
      await tx
        .update(releases)
        .set({ releaseNotes: data.releaseNotes, updatedAt: now })
        .where(eq(releases.id, current.releaseId))
      await tx
        .update(artifacts)
        .set({ releaseNotes: data.releaseNotes, updatedAt: now })
        .where(eq(artifacts.releaseId, current.releaseId))
    }

    const [updated] = await tx
      .update(artifacts)
      .set({
        channel: nextChannel,
        status: nextStatus,
        deprecatedAt,
        updatedAt: now,
      })
      .where(eq(artifacts.id, id))
      .returning()
    return updated
  })

  await writeAudit(c, {
    action: 'artifact.update',
    objectType: 'artifact',
    objectId: row.id,
    applicationId: row.applicationId,
    summary: `更新制品 v${row.version}`,
    meta: {
      channel: row.channel,
      status: row.status,
      markLatest: data.markLatest === true || data.status === 'latest',
      releaseNotes: data.releaseNotes !== undefined,
    },
  })

  return c.json({ artifact: mapArtifact(row) })
})

/** DELETE /artifacts/:id — remove metadata + file */
artifactRoutes.delete('/artifacts/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  const [current] = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'Artifact not found')
  if (!(await hasApplicationRole(c.get('user'), current.applicationId, 'maintainer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }
  const [currentApp] = await db
    .select({ status: applications.status })
    .from(applications)
    .where(eq(applications.id, current.applicationId))
    .limit(1)
  if (currentApp?.status === 'archived') {
    return jsonError(c, 409, 'archived_application', 'Application is archived')
  }

  await db.delete(artifacts).where(eq(artifacts.id, id))
  await deleteArtifactStorageFile(current.storageKey, current.storageBackend)
  await refreshApplicationArtifactStats(current.applicationId)

  await writeAudit(c, {
    action: 'artifact.delete',
    objectType: 'artifact',
    objectId: current.id,
    applicationId: current.applicationId,
    summary: `删除制品 v${current.version}（${current.filename}）`,
    meta: { version: current.version, wasLatest: current.status === 'latest' },
  })

  return c.json({ ok: true })
})
