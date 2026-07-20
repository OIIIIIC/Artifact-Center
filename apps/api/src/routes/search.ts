import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '../db/client.js'
import { applicationMembers, applications, artifacts, regions } from '../db/schema.js'
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
  const user = c.get('user')
  const appFilter = or(
    ilike(applications.name, pattern),
    ilike(applications.packageName, pattern),
    ilike(applications.description, pattern),
    ilike(applications.ownerName, pattern),
    ilike(applications.repository, pattern),
    ilike(applications.latestVersion, pattern),
  )
  const artifactFilter = or(
    ilike(artifacts.version, pattern),
    ilike(artifacts.filename, pattern),
    ilike(artifacts.buildNumber, pattern),
    ilike(artifacts.uploaderName, pattern),
    ilike(artifacts.releaseNotes, pattern),
    ilike(applications.name, pattern),
    ilike(applications.packageName, pattern),
  )

  const appRows =
    user.role === 'admin'
      ? await db
          .select()
          .from(applications)
          .where(appFilter)
          .orderBy(desc(applications.updatedAt))
          .limit(appLimit)
      : (
          await db
            .select({ application: applications })
            .from(applications)
            .innerJoin(
              applicationMembers,
              and(
                eq(applicationMembers.applicationId, applications.id),
                eq(applicationMembers.userId, user.sub),
              ),
            )
            .where(appFilter)
            .orderBy(desc(applications.updatedAt))
            .limit(appLimit)
        ).map((row) => row.application)

  const artifactQuery = db
    .select({
      id: artifacts.id,
      applicationId: artifacts.applicationId,
      releaseId: artifacts.releaseId,
      version: artifacts.version,
      buildNumber: artifacts.buildNumber,
      platform: artifacts.platform,
      type: artifacts.type,
      channel: artifacts.channel,
      status: artifacts.status,
      filename: artifacts.filename,
      sizeBytes: artifacts.sizeBytes,
      sha256: artifacts.sha256,
      releaseNotes: artifacts.releaseNotes,
      uploader: artifacts.uploaderName,
      uploadedAt: artifacts.uploadedAt,
      parsedMeta: artifacts.parsedMeta,
      buildMeta: artifacts.buildMeta,
      appName: applications.name,
      appPackageName: applications.packageName,
      appPlatform: applications.platform,
      regionId: regions.id,
      regionCode: regions.code,
      regionName: regions.name,
      regionSortOrder: regions.sortOrder,
      regionEnabled: regions.enabled,
      regionCreatedAt: regions.createdAt,
      regionUpdatedAt: regions.updatedAt,
    })
    .from(artifacts)
    .innerJoin(applications, sql`${applications.id} = ${artifacts.applicationId}`)
    .innerJoin(regions, eq(regions.id, applications.regionId))

  const artRows =
    user.role === 'admin'
      ? await artifactQuery
          .where(artifactFilter)
          .orderBy(desc(artifacts.uploadedAt))
          .limit(artLimit)
      : await artifactQuery
          .innerJoin(
            applicationMembers,
            and(
              eq(applicationMembers.applicationId, applications.id),
              eq(applicationMembers.userId, user.sub),
            ),
          )
          .where(artifactFilter)
          .orderBy(desc(artifacts.uploadedAt))
          .limit(artLimit)

  const regionRows = await db.select().from(regions)
  const regionById = new Map(regionRows.map((region) => [region.id, region]))

  const applicationsOut = appRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    packageName: row.packageName,
    platform: row.platform,
    region: (() => {
      const region = regionById.get(row.regionId)!
      return {
        id: region.id,
        code: region.code,
        name: region.name,
        sortOrder: region.sortOrder,
        enabled: region.enabled,
        createdAt: region.createdAt.toISOString(),
        updatedAt: region.updatedAt.toISOString(),
      }
    })(),
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
      uploader: r.uploader,
      uploadedAt: r.uploadedAt.toISOString(),
      parsedMeta: r.parsedMeta,
      buildMeta: r.buildMeta,
    },
    application: {
      id: r.applicationId,
      name: r.appName,
      packageName: r.appPackageName,
      platform: r.appPlatform,
      region: {
        id: r.regionId,
        code: r.regionCode,
        name: r.regionName,
        sortOrder: r.regionSortOrder,
        enabled: r.regionEnabled,
        createdAt: r.regionCreatedAt.toISOString(),
        updatedAt: r.regionUpdatedAt.toISOString(),
      },
    },
  }))

  return c.json({
    query: q,
    applications: applicationsOut,
    artifacts: artifactsOut,
    total: applicationsOut.length + artifactsOut.length,
  })
})
