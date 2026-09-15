import { normalizeRepository } from '../lib/repository-binding.js'
import { and, asc, desc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import { applicationMembers, applications, regions } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import { requireUploadAuth, type UploadAuthVariables } from '../middleware/upload-auth.js'
import {
  mapReleaseApplicationTarget,
  releaseApplicationQuerySchema,
} from './upload-inputs.js'

export function registerReleaseApplications(
  uploadRoutes: Hono<{ Variables: UploadAuthVariables }>,
) {
  uploadRoutes.get('/release/applications', requireUploadAuth, async (c) => {
    const parsed = releaseApplicationQuerySchema.safeParse({
      q: c.req.query('q'),
      repository: c.req.query('repository'),
      branch: c.req.query('branch'),
      directory: c.req.query('directory'),
      platform: c.req.query('platform'),
    })
    if (!parsed.success) {
      return jsonError(c, 400, 'invalid_query', 'Invalid application query')
    }

    const { q, platform, repository, branch, directory } = parsed.data
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
    const baseFilter = selectableFilter
      ? and(ne(applications.status, 'archived'), selectableFilter)
      : ne(applications.status, 'archived')

    const filter = repository
      ? and(
          baseFilter,
          sql`${applications.repositoryBindings} @> ${JSON.stringify([{ repositoryKey: normalizeRepository(repository), branch, directory }])}::jsonb`,
        )
      : baseFilter
    const user = c.get('user')
    const rows =
      user.role === 'admin'
        ? await db
            .select({ application: applications, region: regions })
            .from(applications)
            .innerJoin(regions, eq(regions.id, applications.regionId))
            .where(filter)
            .orderBy(desc(applications.updatedAt), asc(applications.name))
            .limit(repository ? 1001 : 100)
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
            .limit(repository ? 1001 : 100)

    if (repository && rows.length > 1000)
      return jsonError(
        c,
        409,
        'too_many_targets',
        'Narrow the repository binding directory',
      )
    const matches = repository
      ? rows.filter((row) =>
          row.application.repositoryBindings.some(
            (binding) =>
              binding.branch === branch &&
              binding.directory === directory &&
              normalizeRepository(binding.repository) === normalizeRepository(repository),
          ),
        )
      : rows
    return c.json({
      items: matches.map((row) =>
        mapReleaseApplicationTarget({
          ...row,
          accessRole: user.role === 'admin' ? 'admin' : 'maintainer',
        }),
      ),
      total: matches.length,
    })
  })
}
