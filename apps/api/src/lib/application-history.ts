import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { db } from '../db/client.js'
import { artifacts, releases } from '../db/schema.js'
import type { AuthVariables } from '../middleware/auth.js'
import { afterCursor, nextCursor, readCollectionPage } from './collection-page.js'
import { jsonError } from './errors.js'

export function mapHistoryArtifact(r: typeof artifacts.$inferSelect) {
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

export async function applicationOverview(c: Context<{ Variables: AuthVariables }>) {
  const id = c.req.param('id')!
  const [recent, latest] = await Promise.all([
    db
      .select()
      .from(artifacts)
      .where(eq(artifacts.applicationId, id))
      .orderBy(desc(artifacts.uploadedAt), desc(artifacts.id))
      .limit(3),
    db
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.applicationId, id), eq(artifacts.status, 'latest')))
      .limit(1),
  ])
  return c.json({
    recent: recent.map(mapHistoryArtifact),
    latest: latest[0] || recent[0] ? mapHistoryArtifact(latest[0] ?? recent[0]) : null,
  })
}

export async function listArtifactPage(c: Context<{ Variables: AuthVariables }>) {
  const id = c.req.param('id')!,
    query = c.req.query()
  let page, cursorWhere
  try {
    page = readCollectionPage(query, JSON.stringify(['artifacts', id, query.q ?? '']))
    cursorWhere = afterCursor(page, artifacts.uploadedAt, artifacts.id, false, true)
  } catch {
    return jsonError(c, 400, 'invalid_page', 'Invalid page or cursor')
  }
  const q = (query.q ?? '').trim().slice(0, 120)
  const where = and(
    eq(artifacts.applicationId, id),
    q
      ? or(
          ilike(artifacts.version, `%${q}%`),
          ilike(artifacts.buildNumber, `%${q}%`),
          ilike(artifacts.filename, `%${q}%`),
        )
      : undefined,
  )
  const [rows, totals] = await Promise.all([
    db
      .select({
        artifact: artifacts,
        cursorValue: sql<string>`${artifacts.uploadedAt}::text`,
      })
      .from(artifacts)
      .where(and(where, cursorWhere))
      .orderBy(desc(artifacts.uploadedAt), desc(artifacts.id))
      .limit(page.limit + 1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(artifacts)
      .where(where),
  ])
  return c.json({
    items: rows.slice(0, page.limit).map((r) => mapHistoryArtifact(r.artifact)),
    total: totals[0].count,
    nextCursor: nextCursor(
      page,
      rows.map((r) => ({ id: r.artifact.id, cursorValue: r.cursorValue })),
    ),
  })
}

export async function listReleasePage(c: Context<{ Variables: AuthVariables }>) {
  const id = c.req.param('id')!,
    query = c.req.query()
  let page, cursorWhere
  try {
    page = readCollectionPage(query, JSON.stringify(['releases', id, query.q ?? '']))
    cursorWhere = afterCursor(page, releases.publishedAt, releases.id, false, true)
  } catch {
    return jsonError(c, 400, 'invalid_page', 'Invalid page or cursor')
  }
  const q = (query.q ?? '').trim().slice(0, 120)
  const where = and(
    eq(releases.applicationId, id),
    q
      ? or(ilike(releases.version, `%${q}%`), ilike(releases.releaseNotes, `%${q}%`))
      : undefined,
  )
  const [rows, totals] = await Promise.all([
    db
      .select({
        release: releases,
        cursorValue: sql<string>`${releases.publishedAt}::text`,
      })
      .from(releases)
      .where(and(where, cursorWhere))
      .orderBy(desc(releases.publishedAt), desc(releases.id))
      .limit(page.limit + 1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(releases)
      .where(where),
  ])
  const displayed = rows.slice(0, page.limit),
    ids = displayed.map((r) => r.release.id)
  const counts = ids.length
    ? await db
        .select({
          id: artifacts.releaseId,
          count: sql<number>`count(*)::int`,
          types: sql<string[]>`array_agg(distinct ${artifacts.type}::text)`,
        })
        .from(artifacts)
        .where(inArray(artifacts.releaseId, ids))
        .groupBy(artifacts.releaseId)
    : []
  const byRelease = new Map(counts.map((r) => [r.id, r]))
  return c.json({
    items: displayed.map(({ release: r }) => ({
      id: r.id,
      applicationId: r.applicationId,
      version: r.version,
      releaseNotes: r.releaseNotes,
      status: r.status,
      createdBy: r.createdByName,
      publishedAt: r.publishedAt.toISOString(),
      artifactCount: byRelease.get(r.id)?.count ?? 0,
      artifactTypes: byRelease.get(r.id)?.types ?? [],
    })),
    total: totals[0].count,
    nextCursor: nextCursor(
      page,
      rows.map((r) => ({ id: r.release.id, cursorValue: r.cursorValue })),
    ),
  })
}
