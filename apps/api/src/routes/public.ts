import { desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { Readable } from 'node:stream'

import { db } from '../db/client.js'
import { applications, artifacts, shareLinks } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { attachmentDisposition } from '../lib/download-response.js'
import { jsonError } from '../lib/errors.js'
import { openDownloadStream } from '../lib/storage.js'

/**
 * Public read/download routes for share landing pages (no auth).
 */
export const publicRoutes = new Hono()

function mapApp(row: typeof applications.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    packageName: row.packageName,
    platform: row.platform,
    repository: row.repository,
    status: row.status,
    owner: row.ownerName,
    latestVersion: row.latestVersion,
    artifactCount: row.artifactCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapArt(r: typeof artifacts.$inferSelect) {
  return {
    id: r.id,
    applicationId: r.applicationId,
    version: r.version,
    buildNumber: r.buildNumber,
    platform: r.platform,
    channel: r.channel,
    status: r.status,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    sha256: r.sha256,
    releaseNotes: r.releaseNotes,
    uploader: r.uploaderName,
    uploadedAt: r.uploadedAt.toISOString(),
  }
}

async function loadActiveShare(token: string) {
  const [share] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1)
  if (!share) return { error: 'not_found' as const }
  if (share.revokedAt) return { error: 'revoked' as const, share }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return { error: 'expired' as const, share }
  }
  return { share }
}

async function resolveShareArtifact(share: typeof shareLinks.$inferSelect) {
  const [app] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, share.applicationId))
    .limit(1)
  if (!app) return { error: 'app_missing' as const }

  let art: typeof artifacts.$inferSelect | undefined
  if (share.mode === 'latest') {
    const rows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.applicationId, share.applicationId))
      .orderBy(desc(artifacts.uploadedAt))
    art = rows.find((a) => a.status === 'latest') ?? rows[0]
  } else if (share.artifactId) {
    const [row] = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, share.artifactId))
      .limit(1)
    art = row
  }

  if (!art) return { error: 'artifact_missing' as const, app }
  return { app, art }
}

/** GET /public/shares/:token — resolve server share for landing page */
publicRoutes.get('/shares/:token', async (c) => {
  const token = c.req.param('token')
  const loaded = await loadActiveShare(token)
  if ('error' in loaded && loaded.error === 'not_found') {
    return jsonError(c, 404, 'not_found', 'Share link not found')
  }
  if ('error' in loaded && loaded.error === 'revoked') {
    return jsonError(c, 410, 'revoked', 'Share link has been revoked')
  }
  if ('error' in loaded && loaded.error === 'expired') {
    return jsonError(c, 410, 'expired', 'Share link has expired')
  }

  const share = loaded.share!
  const resolved = await resolveShareArtifact(share)
  if ('error' in resolved && resolved.error === 'app_missing') {
    return jsonError(c, 404, 'app_missing', 'Application no longer exists')
  }
  if ('error' in resolved && resolved.error === 'artifact_missing') {
    return c.json(
      {
        ok: false,
        reason: 'artifact_missing',
        share: {
          id: share.id,
          mode: share.mode,
          createdBy: share.createdByName,
          expiresAt: share.expiresAt?.toISOString() ?? null,
        },
        application: mapApp(resolved.app!),
      },
      404,
    )
  }

  const { app, art } = resolved as {
    app: typeof applications.$inferSelect
    art: typeof artifacts.$inferSelect
  }

  return c.json({
    ok: true,
    share: {
      id: share.id,
      token: share.token,
      mode: share.mode,
      createdBy: share.createdByName,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString(),
    },
    application: mapApp(app),
    artifact: mapArt(art),
  })
})

/** GET /public/shares/:token/download — download through share capability */
publicRoutes.get('/shares/:token/download', async (c) => {
  const token = c.req.param('token')
  const loaded = await loadActiveShare(token)
  if ('error' in loaded && loaded.error === 'not_found') {
    return jsonError(c, 404, 'not_found', 'Share link not found')
  }
  if ('error' in loaded && (loaded.error === 'revoked' || loaded.error === 'expired')) {
    const code = loaded.error === 'revoked' ? 'revoked' : 'expired'
    return jsonError(
      c,
      410,
      code,
      code === 'revoked' ? 'Share link has been revoked' : 'Share link has expired',
    )
  }

  const share = loaded.share!
  const resolved = await resolveShareArtifact(share)
  if ('error' in resolved) {
    return jsonError(
      c,
      404,
      resolved.error === 'app_missing' ? 'app_missing' : 'artifact_missing',
      'Nothing available to download',
    )
  }

  const art = resolved.art
  const stream = openDownloadStream(art.storageKey)
  if (!stream) {
    return jsonError(c, 404, 'file_missing', 'File missing from storage')
  }

  await db
    .update(shareLinks)
    .set({ downloadCount: sql`${shareLinks.downloadCount} + 1` })
    .where(eq(shareLinks.id, share.id))

  c.header('Content-Disposition', attachmentDisposition(art.filename))
  c.header('Content-Type', 'application/octet-stream')
  c.header('Content-Length', String(art.sizeBytes))

  void writeAudit(c, {
    action: 'share.download',
    objectType: 'artifact',
    objectId: art.id,
    applicationId: art.applicationId,
    summary: `分享下载 ${art.filename} (v${art.version})`,
    meta: { via: 'share_token', shareId: share.id, version: art.version },
    actorName: share.createdByName || 'Share link',
  })

  return c.body(Readable.toWeb(stream) as ReadableStream)
})
