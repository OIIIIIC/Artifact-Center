import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import {
  applicationMembers,
  applications,
  artifacts,
  regions,
  releases,
  users,
} from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { deleteArtifactStorageFile } from '../lib/storage.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { requireApplicationRole } from '../middleware/application-access.js'
import { requireMinRole, requireRoles } from '../middleware/require-role.js'

const platformEnum = z.enum(['android', 'windows', 'zip'])
const statusEnum = z.enum(['active', 'new', 'beta', 'deprecated', 'archived'])
const sortEnum = z.enum(['updated', 'name', 'created'])
const applicationCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const iconKeySchema = z.enum([
  'auto',
  'monitor',
  'smartphone',
  'tablet',
  'heart-pulse',
  'stethoscope',
  'shield',
  'package',
  'radio',
  'building',
  'activity',
  'settings',
])
const iconColorSchema = z.enum([
  'auto',
  'mint',
  'blue',
  'violet',
  'rose',
  'amber',
  'orange',
  'slate',
  'cyan',
  'lime',
])

const createSchema = z.object({
  name: z.string().min(1).max(200),
  applicationCode: applicationCodeSchema,
  description: z.string().min(1).max(4000),
  packageName: z.string().min(1).max(255),
  platform: platformEnum,
  regionId: z.string().uuid(),
  repository: z.string().max(500).optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  applicationCode: applicationCodeSchema.optional(),
  iconKey: iconKeySchema.optional(),
  iconColor: iconColorSchema.optional(),
  description: z.string().min(1).max(4000).optional(),
  packageName: z.string().min(1).max(255).optional(),
  platform: platformEnum.optional(),
  regionId: z.string().uuid().optional(),
  repository: z.string().max(500).optional(),
  status: statusEnum.optional(),
  ownerName: z.string().max(120).optional(),
})

export const bulkApplicationCodesSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        applicationCode: applicationCodeSchema,
      }),
    )
    .min(1)
    .max(200),
})

export const bulkApplicationAppearanceSchema = z
  .object({
    applicationIds: z.array(z.string().uuid()).min(1).max(200),
    iconKey: iconKeySchema.optional(),
    iconColor: iconColorSchema.optional(),
  })
  .refine((value) => value.iconKey !== undefined || value.iconColor !== undefined, {
    message: 'At least one appearance field is required',
  })

function mapRegion(row: typeof regions.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

type ApplicationMemberPreview = {
  id: string
  name: string
  avatarUrl: string | null
}

type ApplicationResponseRow = Pick<
  typeof applications.$inferSelect,
  | 'id'
  | 'name'
  | 'applicationCode'
  | 'iconKey'
  | 'iconColor'
  | 'description'
  | 'packageName'
  | 'platform'
  | 'regionId'
  | 'repository'
  | 'status'
  | 'ownerName'
  | 'latestVersion'
  | 'artifactCount'
  | 'createdAt'
  | 'updatedAt'
> & {
  latestArtifactUploadedAt?: Date | string | null
}

/** 目录与搜索结果不读取 ownerId 等不会返回给客户端的列。 */
const applicationResponseColumns = {
  id: applications.id,
  name: applications.name,
  applicationCode: applications.applicationCode,
  iconKey: applications.iconKey,
  iconColor: applications.iconColor,
  description: applications.description,
  packageName: applications.packageName,
  platform: applications.platform,
  regionId: applications.regionId,
  repository: applications.repository,
  status: applications.status,
  ownerName: applications.ownerName,
  latestVersion: applications.latestVersion,
  artifactCount: applications.artifactCount,
  createdAt: applications.createdAt,
  updatedAt: applications.updatedAt,
}

function toIsoTimestamp(value: Date | string | null | undefined) {
  if (value == null) return null
  return typeof value === 'string' ? new Date(value).toISOString() : value.toISOString()
}

export function mapApp(
  row: ApplicationResponseRow,
  region: typeof regions.$inferSelect,
  members: ApplicationMemberPreview[] = [],
  accessRole: 'admin' | 'maintainer' | 'viewer' = 'viewer',
) {
  return {
    id: row.id,
    name: row.name,
    applicationCode: row.applicationCode,
    iconKey: row.iconKey,
    iconColor: row.iconColor,
    description: row.description,
    packageName: row.packageName,
    platform: row.platform,
    region: mapRegion(region),
    repository: row.repository,
    status: row.status,
    owner: row.ownerName,
    members,
    accessRole,
    latestVersion: row.latestVersion,
    artifactCount: row.artifactCount,
    latestArtifactUploadedAt: toIsoTimestamp(row.latestArtifactUploadedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const applicationRoutes = new Hono<{ Variables: AuthVariables }>()

applicationRoutes.use('*', requireAuth)

applicationRoutes.get('/', async (c) => {
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
    conditions.push(eq(applications.platform, platform as 'android' | 'windows' | 'zip'))
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
      ),
    ),
    total: rows.length,
  })
})

applicationRoutes.patch('/bulk-codes', requireRoles('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = bulkApplicationCodesSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid application code updates',
      parsed.error.flatten(),
    )
  }

  const updates = parsed.data.updates
  const applicationIds = updates.map((update) => update.id)
  if (new Set(applicationIds).size !== applicationIds.length) {
    return jsonError(c, 400, 'duplicate_application', 'Application IDs must be unique')
  }

  const existing = await db
    .select({ id: applications.id })
    .from(applications)
    .where(inArray(applications.id, applicationIds))
  if (existing.length !== applicationIds.length) {
    return jsonError(c, 404, 'not_found', 'One or more applications were not found')
  }

  const updatedAt = new Date()
  await db.transaction(async (tx) => {
    for (const update of updates) {
      await tx
        .update(applications)
        .set({
          applicationCode: update.applicationCode.trim(),
          updatedAt,
        })
        .where(eq(applications.id, update.id))
    }
  })

  await writeAudit(c, {
    action: 'app.update',
    objectType: 'system',
    summary: `批量更新 ${updates.length} 个应用代码`,
    meta: {
      applicationIds,
      fields: ['applicationCode'],
    },
  })

  return c.json({ updated: updates.length })
})

applicationRoutes.patch('/bulk-appearance', requireRoles('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = bulkApplicationAppearanceSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid application appearance update',
      parsed.error.flatten(),
    )
  }

  const applicationIds = [...new Set(parsed.data.applicationIds)]
  const existing = await db
    .select({ id: applications.id })
    .from(applications)
    .where(inArray(applications.id, applicationIds))
  if (existing.length !== applicationIds.length) {
    return jsonError(c, 404, 'not_found', 'One or more applications were not found')
  }

  await db
    .update(applications)
    .set({
      ...(parsed.data.iconKey !== undefined ? { iconKey: parsed.data.iconKey } : {}),
      ...(parsed.data.iconColor !== undefined
        ? { iconColor: parsed.data.iconColor }
        : {}),
      updatedAt: new Date(),
    })
    .where(inArray(applications.id, applicationIds))

  await writeAudit(c, {
    action: 'app.update',
    objectType: 'system',
    summary: `批量更新 ${applicationIds.length} 个应用头像`,
    meta: {
      applicationIds,
      fields: [
        ...(parsed.data.iconKey !== undefined ? ['iconKey'] : []),
        ...(parsed.data.iconColor !== undefined ? ['iconColor'] : []),
      ],
    },
  })

  return c.json({ updated: applicationIds.length })
})

applicationRoutes.get('/:id', requireApplicationRole('id', 'viewer'), async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1)
  if (!row) return jsonError(c, 404, 'not_found', 'Application not found')
  const [region] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, row.regionId))
    .limit(1)
  const [membership] =
    user.role === 'admin'
      ? [{ role: 'admin' as const }]
      : await db
          .select({ role: applicationMembers.role })
          .from(applicationMembers)
          .where(
            and(
              eq(applicationMembers.applicationId, id),
              eq(applicationMembers.userId, user.sub),
            ),
          )
          .limit(1)
  return c.json({ application: mapApp(row, region, [], membership?.role ?? 'viewer') })
})

applicationRoutes.post('/', requireMinRole('maintainer'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid application payload',
      parsed.error.flatten(),
    )
  }

  const user = c.get('user')
  const data = parsed.data
  const packageName = data.packageName.trim()
  const applicationCode = data.applicationCode.trim()

  const [region] = await db
    .select()
    .from(regions)
    .where(and(eq(regions.id, data.regionId), eq(regions.enabled, true)))
    .limit(1)
  if (!region) {
    return jsonError(c, 400, 'region_unavailable', 'Region is unavailable')
  }

  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(applications)
      .values({
        name: data.name.trim(),
        applicationCode,
        description: data.description.trim(),
        packageName,
        platform: data.platform,
        regionId: data.regionId,
        repository: data.repository?.trim() || '',
        status: 'new',
        ownerId: user.sub,
        ownerName: user.name,
        latestVersion: '',
        artifactCount: 0,
      })
      .returning()

    await tx.insert(applicationMembers).values({
      applicationId: created.id,
      userId: user.sub,
      role: 'maintainer',
    })

    return created
  })

  await writeAudit(c, {
    action: 'app.create',
    objectType: 'application',
    objectId: row.id,
    applicationId: row.id,
    summary: `创建应用 ${row.name}`,
    meta: {
      applicationCode: row.applicationCode,
      packageName: row.packageName,
      platform: row.platform,
    },
  })

  return c.json({ application: mapApp(row, region) }, 201)
})

applicationRoutes.patch('/:id', requireApplicationRole('id', 'maintainer'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
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
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'Application not found')

  const data = parsed.data
  const nextApplicationCode = data.applicationCode?.trim() ?? current.applicationCode

  let targetRegion: typeof regions.$inferSelect | undefined
  if (data.regionId !== undefined) {
    const [region] = await db
      .select()
      .from(regions)
      .where(and(eq(regions.id, data.regionId), eq(regions.enabled, true)))
      .limit(1)
    if (!region) {
      return jsonError(c, 400, 'region_unavailable', 'Region is unavailable')
    }
    targetRegion = region
  } else {
    const [region] = await db
      .select()
      .from(regions)
      .where(eq(regions.id, current.regionId))
      .limit(1)
    targetRegion = region
  }

  const [row] = await db
    .update(applications)
    .set({
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.applicationCode !== undefined
        ? { applicationCode: nextApplicationCode }
        : {}),
      ...(data.iconKey !== undefined ? { iconKey: data.iconKey } : {}),
      ...(data.iconColor !== undefined ? { iconColor: data.iconColor } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
      ...(data.packageName !== undefined ? { packageName: data.packageName.trim() } : {}),
      ...(data.platform !== undefined ? { platform: data.platform } : {}),
      ...(data.regionId !== undefined ? { regionId: data.regionId } : {}),
      ...(data.repository !== undefined ? { repository: data.repository.trim() } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.ownerName !== undefined ? { ownerName: data.ownerName.trim() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id))
    .returning()

  await writeAudit(c, {
    action: 'app.update',
    objectType: 'application',
    objectId: row.id,
    applicationId: row.id,
    summary: `更新应用 ${row.name}`,
    meta: { fields: Object.keys(data) },
  })

  return c.json({ application: mapApp(row, targetRegion!) })
})

applicationRoutes.delete('/:id', requireRoles('admin'), async (c) => {
  const id = c.req.param('id')
  const [existing] = await db
    .select({ id: applications.id, name: applications.name })
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1)
  if (!existing) return jsonError(c, 404, 'not_found', 'Application not found')

  const files = await db
    .select({
      storageKey: artifacts.storageKey,
      storageBackend: artifacts.storageBackend,
    })
    .from(artifacts)
    .where(eq(artifacts.applicationId, id))

  await db.delete(applications).where(eq(applications.id, id))
  await Promise.all(
    files.map((file) => deleteArtifactStorageFile(file.storageKey, file.storageBackend)),
  )

  await writeAudit(c, {
    action: 'app.delete',
    objectType: 'application',
    objectId: existing.id,
    applicationId: null,
    summary: `删除应用 ${existing.name}`,
  })

  return c.json({ ok: true })
})

/** Nested: list artifacts for an application */
applicationRoutes.get(
  '/:id/artifacts',
  requireApplicationRole('id', 'viewer'),
  async (c) => {
    const id = c.req.param('id')
    const [app] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1)
    if (!app) return jsonError(c, 404, 'not_found', 'Application not found')

    const rows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.applicationId, id))
      .orderBy(desc(artifacts.uploadedAt))

    return c.json({
      items: rows.map((r) => ({
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
      })),
    })
  },
)

/** 应用发布记录；一个 Release 可关联多个制品。 */
applicationRoutes.get(
  '/:id/releases',
  requireApplicationRole('id', 'viewer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const [releaseRows, artifactRows] = await Promise.all([
      db
        .select()
        .from(releases)
        .where(eq(releases.applicationId, applicationId))
        .orderBy(desc(releases.publishedAt)),
      db
        .select({ releaseId: artifacts.releaseId, type: artifacts.type })
        .from(artifacts)
        .where(eq(artifacts.applicationId, applicationId)),
    ])

    return c.json({
      items: releaseRows.map((release) => {
        const releaseArtifacts = artifactRows.filter(
          (artifact) => artifact.releaseId === release.id,
        )
        return {
          id: release.id,
          applicationId: release.applicationId,
          version: release.version,
          releaseNotes: release.releaseNotes,
          status: release.status,
          createdBy: release.createdByName,
          publishedAt: release.publishedAt.toISOString(),
          artifactCount: releaseArtifacts.length,
          artifactTypes: [...new Set(releaseArtifacts.map((artifact) => artifact.type))],
        }
      }),
      total: releaseRows.length,
    })
  },
)

/** 更新一个发布版本的说明，不修改任何制品事实。 */
applicationRoutes.patch(
  '/:id/releases/:releaseId',
  requireApplicationRole('id', 'maintainer'),
  async (c) => {
    const parsed = z
      .object({ releaseNotes: z.string().max(8000) })
      .safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return jsonError(c, 400, 'invalid_body', 'Invalid release notes')
    }

    const applicationId = c.req.param('id')
    const releaseId = c.req.param('releaseId')
    const [release] = await db
      .select()
      .from(releases)
      .where(and(eq(releases.id, releaseId), eq(releases.applicationId, applicationId)))
      .limit(1)
    if (!release) return jsonError(c, 404, 'not_found', 'Release not found')

    const [application] = await db
      .select({ status: applications.status })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
    if (application?.status === 'archived') {
      return jsonError(c, 409, 'archived_application', 'Application is archived')
    }

    const updatedAt = new Date()
    await db.transaction(async (tx) => {
      await tx
        .update(releases)
        .set({ releaseNotes: parsed.data.releaseNotes, updatedAt })
        .where(eq(releases.id, release.id))
      await tx
        .update(artifacts)
        .set({ releaseNotes: parsed.data.releaseNotes, updatedAt })
        .where(eq(artifacts.releaseId, release.id))
    })

    await writeAudit(c, {
      action: 'release.update',
      objectType: 'release',
      objectId: release.id,
      applicationId,
      summary: `更新 v${release.version} 的发布说明`,
      meta: { releaseNotes: true },
    })

    return c.json({ ok: true })
  },
)

/** 应用成员列表；成员可查看。 */
applicationRoutes.get(
  '/:id/members',
  requireApplicationRole('id', 'viewer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const [app] = await db
      .select({ ownerId: applications.ownerId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: applicationMembers.role,
        platformRole: users.role,
        joinedAt: applicationMembers.createdAt,
      })
      .from(applicationMembers)
      .innerJoin(users, eq(applicationMembers.userId, users.id))
      .where(eq(applicationMembers.applicationId, applicationId))
      .orderBy(asc(users.name))

    return c.json({
      items: rows.map((row) => ({
        ...row,
        isOwner: row.id === app?.ownerId,
        joinedAt: row.joinedAt.toISOString(),
      })),
      total: rows.length,
    })
  },
)

const memberRoleSchema = z.object({ role: z.enum(['maintainer', 'viewer']) })

/** 应用维护者可查询尚未加入应用的账号。 */
applicationRoutes.get(
  '/:id/member-candidates',
  requireApplicationRole('id', 'maintainer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const q = (c.req.query('q') ?? '').trim()
    const filter = q
      ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
      : undefined
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        platformRole: users.role,
      })
      .from(users)
      .leftJoin(
        applicationMembers,
        and(
          eq(applicationMembers.applicationId, applicationId),
          eq(applicationMembers.userId, users.id),
        ),
      )
      .where(and(ne(users.role, 'admin'), isNull(applicationMembers.userId), filter))
      .orderBy(asc(users.name))
      .limit(30)
    return c.json({ items: rows, total: rows.length })
  },
)

/** 应用维护者可添加或更新成员。 */
applicationRoutes.put(
  '/:id/members/:userId',
  requireApplicationRole('id', 'maintainer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const userId = c.req.param('userId')
    const parsed = memberRoleSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return jsonError(
        c,
        400,
        'invalid_body',
        'Invalid member payload',
        parsed.error.flatten(),
      )
    }
    const [target] = await db
      .select({ id: users.id, platformRole: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!target) return jsonError(c, 404, 'not_found', 'User not found')
    if (target.platformRole === 'admin') {
      return jsonError(
        c,
        400,
        'invalid_body',
        'Administrators do not need application membership',
      )
    }
    const [app] = await db
      .select({ ownerId: applications.ownerId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
    if (app?.ownerId === userId && parsed.data.role !== 'maintainer') {
      return jsonError(
        c,
        400,
        'owner_membership_required',
        'Application owner must remain maintainer',
      )
    }

    const [member] = await db
      .insert(applicationMembers)
      .values({ applicationId, userId, role: parsed.data.role, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [applicationMembers.applicationId, applicationMembers.userId],
        set: { role: parsed.data.role, updatedAt: new Date() },
      })
      .returning()
    return c.json({ member }, 200)
  },
)

applicationRoutes.delete(
  '/:id/members/:userId',
  requireApplicationRole('id', 'maintainer'),
  async (c) => {
    const applicationId = c.req.param('id')
    const userId = c.req.param('userId')
    const [app] = await db
      .select({ ownerId: applications.ownerId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
    if (app?.ownerId === userId) {
      return jsonError(
        c,
        400,
        'owner_membership_required',
        'Application owner must remain a member',
      )
    }
    await db
      .delete(applicationMembers)
      .where(
        and(
          eq(applicationMembers.applicationId, applicationId),
          eq(applicationMembers.userId, userId),
        ),
      )
    return c.json({ ok: true })
  },
)
