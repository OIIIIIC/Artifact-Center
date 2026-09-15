import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import {
  applicationMembers,
  applications,
  artifacts,
  projects,
  regions,
} from '../db/schema.js'
import { mapApp } from '../lib/application-response.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { deleteArtifactStorageFile } from '../lib/storage.js'
import { requireApplicationRole } from '../middleware/application-access.js'
import { type AuthVariables } from '../middleware/auth.js'
import { requireMinRole, requireRoles } from '../middleware/require-role.js'
import { createSchema, projectMetadataFor, updateSchema } from './application-inputs.js'

export function registerApplicationDetails(
  applicationRoutes: Hono<{ Variables: AuthVariables }>,
) {
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
    return c.json({
      application: mapApp(
        row,
        region,
        [],
        membership?.role ?? 'viewer',
        await projectMetadataFor(row.projectId),
      ),
    })
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

    if (data.projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, data.projectId),
            eq(projects.productId, data.regionId),
            eq(projects.enabled, true),
          ),
        )
        .limit(1)
      if (!project)
        return jsonError(
          c,
          400,
          'project_unavailable',
          'Project is unavailable in this product',
        )
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
          projectId: data.projectId,
          repository: data.repository?.trim() || '',
          repositoryBindings: data.repositoryBindings ?? [],
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

    return c.json(
      {
        application: mapApp(
          row,
          region,
          [],
          user.role === 'admin' ? 'admin' : 'maintainer',
          await projectMetadataFor(row.projectId),
        ),
      },
      201,
    )
  })

  applicationRoutes.patch(
    '/:id',
    requireApplicationRole('id', 'maintainer'),
    async (c) => {
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
      if (data.regionId !== undefined && data.regionId !== current.regionId) {
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

      const projectChanged =
        data.projectId !== undefined && data.projectId !== current.projectId
      const productChanged =
        data.regionId !== undefined && data.regionId !== current.regionId
      if (projectChanged || productChanged) {
        if (!targetRegion?.enabled)
          return jsonError(c, 400, 'region_unavailable', 'Product is unavailable')
        if (data.projectId) {
          const [project] = await db
            .select()
            .from(projects)
            .where(
              and(
                eq(projects.id, data.projectId),
                eq(projects.productId, targetRegion.id),
                eq(projects.enabled, true),
              ),
            )
            .limit(1)
          if (!project)
            return jsonError(
              c,
              400,
              'project_unavailable',
              'Project is unavailable in this product',
            )
        }
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
          ...(data.description !== undefined
            ? { description: data.description.trim() }
            : {}),
          ...(data.packageName !== undefined
            ? { packageName: data.packageName.trim() }
            : {}),
          ...(data.platform !== undefined ? { platform: data.platform } : {}),
          ...(data.regionId !== undefined ? { regionId: data.regionId } : {}),
          ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
          ...(data.repository !== undefined
            ? { repository: data.repository.trim() }
            : {}),
          ...(data.repositoryBindings !== undefined
            ? { repositoryBindings: data.repositoryBindings }
            : {}),
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

      return c.json({
        application: mapApp(
          row,
          targetRegion!,
          [],
          c.get('user').role === 'admin' ? 'admin' : 'maintainer',
          await projectMetadataFor(row.projectId),
        ),
      })
    },
  )

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
      files.map((file) =>
        deleteArtifactStorageFile(file.storageKey, file.storageBackend),
      ),
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
}
