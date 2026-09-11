import { and, asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client.js'
import {
  applicationMembers,
  applications,
  artifacts,
  releases,
  users,
} from '../db/schema.js'
import {
  applicationOverview,
  listArtifactPage,
  listReleasePage,
} from '../lib/application-history.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { requireApplicationRole } from '../middleware/application-access.js'
import { type AuthVariables } from '../middleware/auth.js'

export function registerApplicationHistory(
  applicationRoutes: Hono<{ Variables: AuthVariables }>,
) {
  applicationRoutes.get(
    '/:id/overview',
    requireApplicationRole('id', 'viewer'),
    applicationOverview,
  )

  applicationRoutes.get(
    '/:id/artifacts',
    requireApplicationRole('id', 'viewer'),
    async (c) => {
      if (c.req.query('limit') !== undefined || c.req.query('cursor') !== undefined)
        return listArtifactPage(c)
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

  applicationRoutes.get(
    '/:id/releases',
    requireApplicationRole('id', 'viewer'),
    async (c) => {
      if (c.req.query('limit') !== undefined || c.req.query('cursor') !== undefined)
        return listReleasePage(c)
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

      const artifactsByRelease = new Map<string, typeof artifactRows>()
      for (const artifact of artifactRows) {
        const group = artifactsByRelease.get(artifact.releaseId) ?? []
        group.push(artifact)
        artifactsByRelease.set(artifact.releaseId, group)
      }
      return c.json({
        items: releaseRows.map((release) => {
          const releaseArtifacts = artifactsByRelease.get(release.id) ?? []
          return {
            id: release.id,
            applicationId: release.applicationId,
            version: release.version,
            releaseNotes: release.releaseNotes,
            status: release.status,
            createdBy: release.createdByName,
            publishedAt: release.publishedAt.toISOString(),
            artifactCount: releaseArtifacts.length,
            artifactTypes: [
              ...new Set(releaseArtifacts.map((artifact) => artifact.type)),
            ],
          }
        }),
        total: releaseRows.length,
      })
    },
  )

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
          avatarUrl: users.avatarUrl,
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
}
