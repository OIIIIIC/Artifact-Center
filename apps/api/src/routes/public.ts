import { eq, sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { Readable } from 'node:stream'

import { db } from '../db/client.js'
import { shareLinkItems, shareLinks } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { attachmentDisposition } from '../lib/download-response.js'
import { jsonError } from '../lib/errors.js'
import {
  resolveShare,
  resolveShareItem,
  type ResolvedShareItem,
} from '../lib/share-resolution.js'
import { openDownloadStream } from '../lib/storage.js'

/** Public read/download routes for server-issued capability links. */
export const publicRoutes = new Hono()

function mapRegion(region: ResolvedShareItem['region']) {
  return {
    id: region.id,
    code: region.code,
    name: region.name,
    sortOrder: region.sortOrder,
    enabled: region.enabled,
    createdAt: region.createdAt.toISOString(),
    updatedAt: region.updatedAt.toISOString(),
  }
}

function mapApp(entry: ResolvedShareItem) {
  const { application, region } = entry
  return {
    id: application.id,
    name: application.name,
    description: application.description,
    packageName: application.packageName,
    platform: application.platform,
    region: mapRegion(region),
    repository: application.repository,
    status: application.status,
    owner: application.ownerName,
    latestVersion: application.latestVersion,
    artifactCount: application.artifactCount,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  }
}

function mapArt(artifact: NonNullable<ResolvedShareItem['artifact']>) {
  return {
    id: artifact.id,
    applicationId: artifact.applicationId,
    releaseId: artifact.releaseId,
    version: artifact.version,
    buildNumber: artifact.buildNumber,
    platform: artifact.platform,
    type: artifact.type,
    channel: artifact.channel,
    status: artifact.status,
    filename: artifact.filename,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    releaseNotes: artifact.releaseNotes,
    uploader: artifact.uploaderName,
    uploadedAt: artifact.uploadedAt.toISOString(),
  }
}

function mapShareError(c: Context, status: 'not_found' | 'revoked' | 'expired') {
  if (status === 'not_found') {
    return jsonError(c, 404, 'not_found', 'Share link not found')
  }
  return jsonError(
    c,
    410,
    status,
    status === 'revoked' ? 'Share link has been revoked' : 'Share link has expired',
  )
}

async function streamItem(
  c: Context,
  share: Extract<Awaited<ReturnType<typeof resolveShare>>, { status: 'ok' }>['share'],
  entry: ResolvedShareItem,
) {
  const artifact = entry.artifact
  if (!artifact) {
    return jsonError(c, 404, 'artifact_missing', 'Nothing available to download')
  }
  const stream = openDownloadStream(artifact.storageKey)
  if (!stream) return jsonError(c, 404, 'file_missing', 'File missing from storage')

  await Promise.all([
    db
      .update(shareLinks)
      .set({ downloadCount: sql`${shareLinks.downloadCount} + 1` })
      .where(eq(shareLinks.id, share.id)),
    db
      .update(shareLinkItems)
      .set({ downloadCount: sql`${shareLinkItems.downloadCount} + 1` })
      .where(eq(shareLinkItems.id, entry.item.id)),
  ])

  c.header('Content-Disposition', attachmentDisposition(artifact.filename))
  c.header('Content-Type', 'application/octet-stream')
  c.header('Content-Length', String(artifact.sizeBytes))

  void writeAudit(c, {
    action: 'share.download',
    objectType: 'artifact',
    objectId: artifact.id,
    applicationId: artifact.applicationId,
    summary: `分享下载 ${artifact.filename} (v${artifact.version})`,
    meta: {
      via: 'share_token',
      shareId: share.id,
      shareItemId: entry.item.id,
      version: artifact.version,
    },
    actorName: share.createdByName || 'Share link',
  })

  return c.body(Readable.toWeb(stream) as ReadableStream)
}

/** GET /public/shares/:token — resolve one or many Share Items. */
publicRoutes.get('/shares/:token', async (c) => {
  const resolution = await resolveShare(c.req.param('token'))
  if (resolution.status !== 'ok') return mapShareError(c, resolution.status)

  const region = resolution.items[0]?.region ?? null
  return c.json({
    ok: true,
    share: {
      id: resolution.share.id,
      token: resolution.share.token,
      kind: resolution.share.kind,
      title: resolution.share.title,
      regionId: resolution.share.regionId,
      createdBy: resolution.share.createdByName,
      expiresAt: resolution.share.expiresAt?.toISOString() ?? null,
      createdAt: resolution.share.createdAt.toISOString(),
      downloadCount: resolution.share.downloadCount,
    },
    region: region ? mapRegion(region) : null,
    items: resolution.items.map((entry) => ({
      id: entry.item.id,
      mode: entry.item.mode,
      downloadCount: entry.item.downloadCount,
      available: Boolean(entry.artifact),
      unavailableReason: entry.unavailableReason,
      application: mapApp(entry),
      artifact: entry.artifact ? mapArt(entry.artifact) : null,
    })),
  })
})

/** GET /public/shares/:token/items/:itemId/download */
publicRoutes.get('/shares/:token/items/:itemId/download', async (c) => {
  const resolution = await resolveShareItem(c.req.param('token'), c.req.param('itemId'))
  if (resolution.status === 'item_not_found') {
    return jsonError(c, 404, 'item_not_found', 'Share item not found')
  }
  if (resolution.status !== 'ok') return mapShareError(c, resolution.status)
  return streamItem(c, resolution.share, resolution.resolvedItem)
})

/** 兼容旧客户端：单项链接继续使用原下载地址。 */
publicRoutes.get('/shares/:token/download', async (c) => {
  const resolution = await resolveShare(c.req.param('token'))
  if (resolution.status !== 'ok') return mapShareError(c, resolution.status)
  const firstAvailable = resolution.items.find((entry) => entry.artifact)
  if (!firstAvailable) {
    return jsonError(c, 404, 'artifact_missing', 'Nothing available to download')
  }
  return streamItem(c, resolution.share, firstAvailable)
})
