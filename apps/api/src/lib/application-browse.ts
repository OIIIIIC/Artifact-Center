import { normalizePlatform } from './artifact-types.js'
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import { db } from '../db/client.js'
import {
  applications,
  applicationMembers,
  projects,
  regions,
  users,
} from '../db/schema.js'
import type { AuthVariables } from '../middleware/auth.js'
import { afterCursor, nextCursor, readCollectionPage } from './collection-page.js'
import {
  applicationResponseColumns,
  mapApp,
  type ApplicationMemberPreview,
} from './application-response.js'
import { jsonError } from './errors.js'

type User = AuthVariables['user']
export function visibleApplications(user: User, mine = false): SQL | undefined {
  if (user.role === 'admin') return undefined
  return sql`exists (select 1 from application_members m where m.application_id = ${applications.id} and m.user_id = ${user.sub} ${mine ? sql`and m.role = 'maintainer'` : sql``})`
}

export async function applicationDirectorySummary(
  c: Context<{ Variables: AuthVariables }>,
) {
  const user = c.get('user')
  const maintainable =
    user.role === 'admin'
      ? sql`true`
      : sql`exists (select 1 from application_members m where m.application_id = ${applications.id} and m.user_id = ${user.sub} and m.role = 'maintainer')`
  const rows = await db
    .select({
      productId: applications.regionId,
      projectId: applications.projectId,
      count: sql<number>`count(*)::int`,
      maintainableCount: sql<number>`count(*) filter (where ${maintainable} and ${applications.status} <> 'archived')::int`,
    })
    .from(applications)
    .where(visibleApplications(user))
    .groupBy(applications.regionId, applications.projectId)
  const productCounts: Record<string, number> = {},
    projectCounts: Record<string, number> = {},
    maintainableCounts: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    total += row.count
    productCounts[row.productId] = (productCounts[row.productId] ?? 0) + row.count
    projectCounts[row.projectId] = row.count
    maintainableCounts[row.productId] =
      (maintainableCounts[row.productId] ?? 0) + row.maintainableCount
  }
  return c.json({ total, productCounts, projectCounts, maintainableCounts })
}

export async function listApplicationPage(c: Context<{ Variables: AuthVariables }>) {
  const query = c.req.query(),
    user = c.get('user')
  const sort = ['name', 'created'].includes(query.sort) ? query.sort : 'updated'
  const nameOrder = sort === 'name'
  const column = nameOrder
    ? applications.name
    : sort === 'created'
      ? applications.createdAt
      : applications.updatedAt
  const scope = JSON.stringify([
    user.sub,
    user.role,
    query.q ?? '',
    query.platform ?? '',
    query.product ?? query.region ?? '',
    query.project ?? '',
    query.scope ?? '',
    query.favorites ?? '',
    sort,
  ])
  let page, cursorWhere
  try {
    page = readCollectionPage(query, scope)
    cursorWhere = afterCursor(page, column, applications.id, nameOrder, !nameOrder)
  } catch {
    return jsonError(c, 400, 'invalid_page', 'Invalid page or cursor')
  }
  const conditions = [visibleApplications(user, query.scope === 'mine')]
  const q = (query.q ?? '').trim().slice(0, 120)
  if (q)
    conditions.push(
      or(
        ...[
          applications.name,
          applications.applicationCode,
          applications.packageName,
          applications.ownerName,
        ].map((field) => ilike(field, `%${q}%`)),
      ),
    )
  const platform = normalizePlatform(query.platform)
  if (typeof platform === 'string' && ['android', 'windows', 'linux'].includes(platform))
    conditions.push(sql`${applications.platform} = ${platform}`)
  const product = query.product ?? query.region
  // Invalid UUID filters must produce a client error, never a database error.
  for (const id of [product, query.project]) {
    if (id && !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id))
      return jsonError(c, 400, 'invalid_filter', 'Invalid directory filter')
  }
  if (product) conditions.push(eq(applications.regionId, product))
  if (query.project) conditions.push(eq(applications.projectId, query.project))
  if (query.favorites === '1')
    conditions.push(
      sql`exists (select 1 from user_application_preferences f where f.application_id = ${applications.id} and f.user_id = ${user.sub} and f.favorite = true)`,
    )
  const accessRole =
    user.role === 'admin'
      ? sql<'admin'>`'admin'`
      : sql<
          'maintainer' | 'viewer'
        >`(select m.role from application_members m where m.application_id = ${applications.id} and m.user_id = ${user.sub})`
  const [rows, totals] = await Promise.all([
    db
      .select({
        application: applicationResponseColumns,
        region: regions,
        projectName: projects.name,
        accessRole,
        cursorValue: sql<string>`${column}::text`,
        latestArtifactUploadedAt: sql<
          string | null
        >`(select a.uploaded_at from artifacts a where a.application_id = ${applications.id} order by a.uploaded_at desc limit 1)`,
      })
      .from(applications)
      .innerJoin(regions, eq(regions.id, applications.regionId))
      .innerJoin(projects, eq(projects.id, applications.projectId))
      .where(and(...conditions, cursorWhere))
      .orderBy(
        nameOrder ? asc(column) : desc(column),
        nameOrder ? asc(applications.id) : desc(applications.id),
      )
      .limit(page.limit + 1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(and(...conditions)),
  ])
  const displayed = rows.slice(0, page.limit)
  const ids = displayed.map((r) => r.application.id)
  const memberRows = ids.length
    ? await db
        .select({
          applicationId: applicationMembers.applicationId,
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        })
        .from(applicationMembers)
        .innerJoin(users, eq(users.id, applicationMembers.userId))
        .where(inArray(applicationMembers.applicationId, ids))
        .orderBy(asc(users.name))
    : []
  const members = new Map<string, ApplicationMemberPreview[]>()
  for (const m of memberRows) {
    const list = members.get(m.applicationId) ?? []
    list.push({ id: m.id, name: m.name, avatarUrl: m.avatarUrl })
    members.set(m.applicationId, list)
  }
  return c.json({
    items: displayed.map((r) =>
      mapApp(
        { ...r.application, latestArtifactUploadedAt: r.latestArtifactUploadedAt },
        r.region,
        members.get(r.application.id),
        r.accessRole,
        r.projectName,
      ),
    ),
    total: totals[0].count,
    nextCursor: nextCursor(
      page,
      rows.map((r) => ({ id: r.application.id, cursorValue: r.cursorValue })),
    ),
  })
}
