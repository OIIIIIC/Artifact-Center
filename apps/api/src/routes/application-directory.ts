import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import {
  applicationMembers,
  applications,
  artifacts,
  projects,
  regions,
  users,
} from '../db/schema.js'
import {
  applicationDirectorySummary,
  listApplicationPage,
} from '../lib/application-browse.js'
import {
  applicationResponseColumns,
  mapApp,
  type ApplicationMemberPreview,
  type ApplicationResponseRow,
} from '../lib/application-response.js'
import { type AuthVariables } from '../middleware/auth.js'
import { platformEnum, sortEnum } from './application-inputs.js'

export function registerApplicationDirectory(
  applicationRoutes: Hono<{ Variables: AuthVariables }>,
) {
  applicationRoutes.get('/summary', applicationDirectorySummary)

  applicationRoutes.get('/', async (c) => {
    if (c.req.query('limit') !== undefined || c.req.query('cursor') !== undefined)
      return listApplicationPage(c)
    const q = (c.req.query('q') ?? '').trim()
    const platform = c.req.query('platform') ?? 'all'
    const sort = sortEnum.safeParse(c.req.query('sort') ?? 'updated')
    const sortKey = sort.success ? sort.data : 'updated'

    const conditions = []
    if (q) {
      const pattern = `%${q}%`
      conditions.push(
        or(
          ilike(applications.name, pattern),
          ilike(applications.applicationCode, pattern),
          ilike(applications.packageName, pattern),
          ilike(applications.ownerName, pattern),
        )!,
      )
    }
    if (platform !== 'all' && platformEnum.safeParse(platform).success) {
      conditions.push(
        eq(applications.platform, platform as 'android' | 'windows' | 'zip'),
      )
    }

    const where = conditions.length ? and(...conditions) : undefined

    const order =
      sortKey === 'name'
        ? asc(applications.name)
        : sortKey === 'created'
          ? desc(applications.createdAt)
          : desc(applications.updatedAt)

    const user = c.get('user')
    const rows: Array<{
      application: ApplicationResponseRow
      accessRole: 'admin' | 'maintainer' | 'viewer'
    }> =
      user.role === 'admin'
        ? (
            await db
              .select({ application: applicationResponseColumns })
              .from(applications)
              .where(where)
              .orderBy(order)
          ).map((row) => ({ application: row.application, accessRole: 'admin' }))
        : (
            await db
              .select({
                application: applicationResponseColumns,
                accessRole: applicationMembers.role,
              })
              .from(applications)
              .innerJoin(
                applicationMembers,
                and(
                  eq(applicationMembers.applicationId, applications.id),
                  eq(applicationMembers.userId, user.sub),
                ),
              )
              .where(where)
              .orderBy(order)
          ).map((row) => ({
            application: row.application,
            accessRole: row.accessRole,
          }))

    const projectIds = [
      ...new Set(
        rows
          .map(({ application }) => application.projectId)
          .filter((id): id is string => !!id),
      ),
    ]
    const projectRows = projectIds.length
      ? await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : []
    const projectNames = new Map(projectRows.map((p) => [p.id, p.name]))
    const regionRows = await db.select().from(regions)
    const regionById = new Map(regionRows.map((region) => [region.id, region]))
    const applicationIds = rows.map(({ application }) => application.id)
    const latestArtifactRows = applicationIds.length
      ? await db
          .select({
            applicationId: artifacts.applicationId,
            latestArtifactUploadedAt: sql<
              Date | string | null
            >`max(${artifacts.uploadedAt})`,
          })
          .from(artifacts)
          .where(inArray(artifacts.applicationId, applicationIds))
          .groupBy(artifacts.applicationId)
      : []
    const latestArtifactByApplication = new Map(
      latestArtifactRows.map((row) => [row.applicationId, row.latestArtifactUploadedAt]),
    )
    const memberRows = applicationIds.length
      ? await db
          .select({
            applicationId: applicationMembers.applicationId,
            id: users.id,
            name: users.name,
            avatarUrl: users.avatarUrl,
          })
          .from(applicationMembers)
          .innerJoin(users, eq(applicationMembers.userId, users.id))
          .where(inArray(applicationMembers.applicationId, applicationIds))
          .orderBy(asc(users.name))
      : []
    const membersByApplication = new Map<string, ApplicationMemberPreview[]>()
    memberRows.forEach((member) => {
      const members = membersByApplication.get(member.applicationId) ?? []
      members.push({
        id: member.id,
        name: member.name,
        avatarUrl: member.avatarUrl,
      })
      membersByApplication.set(member.applicationId, members)
    })

    return c.json({
      items: rows.map(({ application: row, accessRole }) =>
        mapApp(
          {
            ...row,
            latestArtifactUploadedAt: latestArtifactByApplication.get(row.id) ?? null,
          },
          regionById.get(row.regionId)!,
          membersByApplication.get(row.id),
          accessRole,
          row.projectId ? projectNames.get(row.projectId) : undefined,
        ),
      ),
      total: rows.length,
    })
  })
}
