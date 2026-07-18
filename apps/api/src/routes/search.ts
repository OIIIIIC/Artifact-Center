import { desc, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '../db/client.js'
import { applications, artifacts } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'

/**
 * GET /search?q= — applications + artifacts for global search.
 */
export const searchRoutes = new Hono<{ Variables: AuthVariables }>()

searchRoutes.use('*', requireAuth)

searchRoutes.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  const appLimit = Math.min(40, Math.max(1, Number(c.req.query('apps') ?? 20) || 20))
  const artLimit = Math.min(60, Math.max(1, Number(c.req.query('artifacts') ?? 30) || 30))

  if (!q) {
    return c.json({ query: '', applications: [], artifacts: [], total: 0 })
  }
  if (q.length > 120) {
    return jsonError(c, 400, 'invalid_query', 'Query too long')
  }

  const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`

  const appRows = await db
    .select()
    .from(applications)
    .where(
      or(
        ilike(applications.name, pattern),
        ilike(applications.packageName, pattern),
        ilike(applications.description, pattern),
        ilike(applications.ownerName, pattern),
        ilike(applications.repository, pattern),
        ilike(applications.latestVersion, pattern),
      ),
    )
    .orderBy(desc(applications.updatedAt))
    .limit(appLimit)

  const artRows = await db
    .select({
      id: artifacts.id,
      applicationId: artifacts.applicationId,
      version: artifacts.version,
      buildNumber: artifacts.buildNumber,
      platform: artifacts.platform,
      channel: artifacts.channel,
      status: artifacts.status,
      filename: artifacts.filename,
      sizeBytes: artifacts.sizeBytes,
      sha256: artifacts.sha256,
      releaseNotes: artifacts.releaseNotes,
      uploader: artifacts.uploaderName,
      uploadedAt: artifacts.uploadedAt,
      appName: applications.name,
      appPackageName: applications.packageName,
      appPlatform: applications.platform,
    })
    .from(artifacts)
    .innerJoin(applications, sql`${applications.id} = ${artifacts.applicationId}`)
    .where(
      or(
        ilike(artifacts.version, pattern),
        ilike(artifacts.filename, pattern),
        ilike(artifacts.buildNumber, pattern),
        ilike(artifacts.uploaderName, pattern),
        ilike(artifacts.releaseNotes, pattern),
        ilike(applications.name, pattern),
        ilike(applications.packageName, pattern),
      ),
    )
    .orderBy(desc(artifacts.uploadedAt))
    .limit(artLimit)

  const applicationsOut = appRows.map((row) => ({
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
  }))

  const artifactsOut = artRows.map((r) => ({
    artifact: {
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
      uploader: r.uploader,
      uploadedAt: r.uploadedAt.toISOString(),
    },
    application: {
      id: r.applicationId,
      name: r.appName,
      packageName: r.appPackageName,
      platform: r.appPlatform,
    },
  }))

  return c.json({
    query: q,
    applications: applicationsOut,
    artifacts: artifactsOut,
    total: applicationsOut.length + artifactsOut.length,
  })
})
