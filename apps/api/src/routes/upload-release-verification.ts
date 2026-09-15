import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import { applications, artifacts, regions } from '../db/schema.js'
import { mapArtifact } from '../lib/artifact-response.js'
import { jsonError } from '../lib/errors.js'
import { openArtifactDownloadStream } from '../lib/storage.js'
import { hasApplicationRole } from '../middleware/application-access.js'
import { requireUploadAuth, type UploadAuthVariables } from '../middleware/upload-auth.js'

export function registerReleaseVerification(
  uploadRoutes: Hono<{ Variables: UploadAuthVariables }>,
) {
  uploadRoutes.get(
    '/release/applications/:appId/target',
    requireUploadAuth,
    async (c) => {
      const applicationId = c.req.param('appId')
      if (!(await hasApplicationRole(c.get('user'), applicationId, 'maintainer'))) {
        return jsonError(c, 403, 'forbidden', 'Insufficient application role to publish')
      }

      const [row] = await db
        .select({
          applicationId: applications.id,
          applicationName: applications.name,
          applicationCode: applications.applicationCode,
          repositoryBindings: applications.repositoryBindings,
          projectId: applications.projectId,
          packageName: applications.packageName,
          platform: applications.platform,
          status: applications.status,
          regionId: regions.id,
          regionCode: regions.code,
          regionName: regions.name,
        })
        .from(applications)
        .innerJoin(regions, eq(regions.id, applications.regionId))
        .where(eq(applications.id, applicationId))
        .limit(1)
      if (!row) return jsonError(c, 404, 'not_found', 'Application not found')
      if (row.status === 'archived') {
        return jsonError(c, 409, 'archived_application', 'Application is archived')
      }

      return c.json({
        target: {
          applicationId: row.applicationId,
          applicationName: row.applicationName,
          applicationCode: row.applicationCode,
          repositoryBindings: row.repositoryBindings ?? [],
          projectId: row.projectId,
          packageName: row.packageName,
          platform: row.platform,
          status: row.status,
          region: {
            id: row.regionId,
            code: row.regionCode,
            name: row.regionName,
          },
        },
      })
    },
  )

  uploadRoutes.get('/release/artifacts/:id/verify', requireUploadAuth, async (c) => {
    const [artifact] = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, c.req.param('id')))
      .limit(1)
    if (!artifact) return jsonError(c, 404, 'not_found', 'Artifact not found')

    const credential = c.get('uploadCredential')
    if (
      credential.kind === 'release-credential' &&
      artifact.channel !== 'beta' &&
      artifact.channel !== 'stable'
    ) {
      return jsonError(
        c,
        403,
        'release_credential_scope',
        'Artifact is outside credential scope',
      )
    }
    if (!(await hasApplicationRole(c.get('user'), artifact.applicationId, 'viewer'))) {
      return jsonError(c, 403, 'forbidden', 'Insufficient application role')
    }

    const stream = await openArtifactDownloadStream(
      artifact.storageKey,
      artifact.storageBackend,
    )
    if (!stream) return jsonError(c, 409, 'file_missing', 'Artifact file is unavailable')
    stream.destroy()
    const [target] = await db
      .select({
        applicationName: applications.name,
        platform: applications.platform,
        regionCode: regions.code,
        regionName: regions.name,
      })
      .from(applications)
      .innerJoin(regions, eq(regions.id, applications.regionId))
      .where(eq(applications.id, artifact.applicationId))
      .limit(1)
    if (!target) {
      return jsonError(c, 409, 'target_missing', 'Artifact target is unavailable')
    }
    return c.json({
      available: true,
      artifact: mapArtifact(artifact),
      target: {
        applicationId: artifact.applicationId,
        applicationName: target.applicationName,
        platform: target.platform,
        region: { code: target.regionCode, name: target.regionName },
      },
      pagePath: `/applications/${artifact.applicationId}`,
      verifiedAt: new Date().toISOString(),
    })
  })
}
