import { and, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { artifacts, releases } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { hasApplicationRole } from '../middleware/application-access.js'
import { requireUploadAuth, type UploadAuthVariables } from '../middleware/upload-auth.js'

const patchReleaseArtifactSchema = z
  .object({
    releaseNotes: z.string().max(8000).optional(),
    /** A beta artifact may become stable only through this explicit action. */
    promoteToStable: z.literal(true).optional(),
    /** Required acknowledgement for a stable promotion. */
    confirmStablePromotion: z.literal(true).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.promoteToStable && !data.confirmStablePromotion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmStablePromotion'],
        message: 'Stable promotion requires explicit confirmation',
      })
    }
    if (data.releaseNotes === undefined && data.promoteToStable === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one editable field is required',
      })
    }
  })

function mapArtifact(row: typeof artifacts.$inferSelect) {
  return {
    id: row.id,
    applicationId: row.applicationId,
    releaseId: row.releaseId,
    version: row.version,
    buildNumber: row.buildNumber,
    platform: row.platform,
    type: row.type,
    channel: row.channel,
    status: row.status,
    originalFilename: row.originalFilename,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    releaseNotes: row.releaseNotes,
    uploader: row.uploaderName,
    uploadedAt: row.uploadedAt.toISOString(),
    parsedMeta: row.parsedMeta,
    buildMeta: row.buildMeta,
  }
}

/**
 * MCP-safe artifact mutation surface.  It deliberately excludes deletion,
 * latest selection, and arbitrary status changes.
 */
export const releaseArtifactRoutes = new Hono<{ Variables: UploadAuthVariables }>()

releaseArtifactRoutes.patch('/artifacts/:id', requireUploadAuth, async (c) => {
  const parsed = patchReleaseArtifactSchema.safeParse(
    await c.req.json().catch(() => null),
  )
  if (!parsed.success) {
    return jsonError(c, 400, 'invalid_body', 'Invalid release artifact patch')
  }

  const [current] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, c.req.param('id')))
    .limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'Artifact not found')

  const user = c.get('user')
  const credential = c.get('uploadCredential')
  if (credential.kind === 'release-credential') {
    // The credential represents its creating admin, but may modify only builds
    // that this actor originally uploaded, and never deprecated/internal ones.
    if (
      current.uploaderId !== user.sub ||
      (current.channel !== 'beta' && current.channel !== 'stable')
    ) {
      return jsonError(c, 403, 'forbidden', 'Artifact is outside credential scope')
    }
  } else if (!(await hasApplicationRole(user, current.applicationId, 'maintainer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  if (parsed.data.promoteToStable && current.channel !== 'beta') {
    return jsonError(
      c,
      409,
      'invalid_promotion',
      'Only beta artifacts can be promoted to stable',
    )
  }

  const now = new Date()
  const updated = await db.transaction(async (tx) => {
    const [updatedArtifact] = await tx
      .update(artifacts)
      .set({
        ...(parsed.data.releaseNotes !== undefined
          ? { releaseNotes: parsed.data.releaseNotes }
          : {}),
        ...(parsed.data.promoteToStable
          ? { channel: 'stable' as const, status: 'stable' as const }
          : {}),
        updatedAt: now,
      })
      .where(eq(artifacts.id, current.id))
      .returning()

    if (parsed.data.releaseNotes !== undefined) {
      // Release History reads `releases.releaseNotes`; keep it and every
      // artifact in the release synchronized in the same transaction.
      await tx
        .update(releases)
        .set({ releaseNotes: parsed.data.releaseNotes, updatedAt: now })
        .where(eq(releases.id, current.releaseId))
      await tx
        .update(artifacts)
        .set({ releaseNotes: parsed.data.releaseNotes, updatedAt: now })
        .where(
          and(eq(artifacts.releaseId, current.releaseId), ne(artifacts.id, current.id)),
        )
    }
    return updatedArtifact
  })

  await writeAudit(c, {
    action: 'artifact.update',
    objectType: 'artifact',
    objectId: current.id,
    applicationId: current.applicationId,
    summary: `更新发布制品 ${current.filename}`,
    meta: {
      releaseNotes: parsed.data.releaseNotes !== undefined,
      promotedToStable: parsed.data.promoteToStable === true,
      via: credential.kind,
    },
  })
  return c.json({ artifact: mapArtifact(updated) })
})
