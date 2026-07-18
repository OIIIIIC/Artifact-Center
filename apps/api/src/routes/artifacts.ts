import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { Readable } from 'node:stream'
import { z } from 'zod'

import { db } from '../db/client.js'
import { applications, artifacts, releases } from '../db/schema.js'
import {
  refreshApplicationArtifactStats,
  statusFromChannel,
} from '../lib/artifact-helpers.js'
import { writeAudit } from '../lib/audit.js'
import { attachmentDisposition } from '../lib/download-response.js'
import { enforceRetentionAfterUpload } from '../lib/retention.js'
import { jsonError } from '../lib/errors.js'
import {
  deleteStorageFile,
  ensureStorageRoot,
  openDownloadStream,
  saveUploadBuffer,
  storageKeyFor,
} from '../lib/storage.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import {
  hasApplicationRole,
  requireApplicationRole,
} from '../middleware/application-access.js'
import { requireMinRole } from '../middleware/require-role.js'

/** Max artifact size — keep in sync with frontend UPLOAD_MAX_BYTES */
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024 // 512 MB

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

function mapArtifact(r: typeof artifacts.$inferSelect) {
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
  requireMinRole('maintainer'),
  requireApplicationRole('appId', 'maintainer'),
  async (c) => {
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

    const body = await c.req.parseBody()
    const file = body['file']
    if (!file || !(file instanceof File)) {
      return jsonError(c, 400, 'file_required', 'Multipart field "file" is required')
    }
    if (file.size <= 0) {
      return jsonError(c, 400, 'empty_file', 'Empty file')
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonError(c, 400, 'too_large', `Max size is ${MAX_UPLOAD_BYTES} bytes`)
    }

    const artifactType = resolveArtifactType(file.name)
    if (!artifactType) {
      return jsonError(c, 400, 'unsupported_file_type', 'Unsupported artifact file type')
    }

    const version = String(body['version'] ?? '').trim()
    const buildNumber = String(body['buildNumber'] ?? '').trim()
    const releaseNotes = String(body['releaseNotes'] ?? '').trim()
    const markLatest = String(body['markLatest'] ?? 'true') !== 'false'
    const channelParsed = channelEnum.safeParse(String(body['channel'] ?? 'stable'))
    const platformParsed = platformEnum.safeParse(
      String(body['platform'] ?? app.platform),
    )

    if (!version) {
      return jsonError(c, 400, 'invalid_body', 'version is required')
    }
    if (!channelParsed.success || !platformParsed.success) {
      return jsonError(c, 400, 'invalid_body', 'Invalid channel or platform')
    }

    const platform = platformParsed.data
    if (platform !== platformForArtifactType(artifactType)) {
      return jsonError(
        c,
        400,
        'platform_mismatch',
        'File type does not match application platform',
      )
    }
    if (platform !== app.platform) {
      return jsonError(
        c,
        400,
        'platform_mismatch',
        'File type does not match application platform',
      )
    }

    ensureStorageRoot()
    const storageKey = storageKeyFor(appId, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const { sizeBytes, sha256 } = await saveUploadBuffer(storageKey, buffer)

    const channel = channelParsed.data
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
            buildNumber: buildNumber || '1',
            platform,
            type: artifactType,
            channel,
            status,
            filename: file.name,
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

    // Enforce max-versions after upload
    await enforceRetentionAfterUpload(appId)

    await writeAudit(c, {
      action: 'artifact.upload',
      objectType: 'artifact',
      objectId: row.id,
      applicationId: appId,
      summary: `上传 ${app.name} v${version}（${file.name}）`,
      meta: {
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
  const [row] = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1)
  if (!row) return jsonError(c, 404, 'not_found', 'Artifact not found')
  if (!(await hasApplicationRole(c.get('user'), row.applicationId, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  const stream = openDownloadStream(row.storageKey)
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
    summary: `下载 ${row.filename} (v${row.version})`,
    meta: { version: row.version, sizeBytes: row.sizeBytes },
  })

  return c.body(Readable.toWeb(stream) as ReadableStream)
})

/** PATCH /artifacts/:id — channel / status / notes / mark latest */
artifactRoutes.patch(
  '/artifacts/:id',
  requireAuth,
  requireMinRole('maintainer'),
  async (c) => {
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

    const [current] = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, id))
      .limit(1)
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
  },
)

/** DELETE /artifacts/:id — remove metadata + file */
artifactRoutes.delete(
  '/artifacts/:id',
  requireAuth,
  requireMinRole('maintainer'),
  async (c) => {
    const id = c.req.param('id')
    const [current] = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, id))
      .limit(1)
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
    await deleteStorageFile(current.storageKey)
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
  },
)
