import { eq, sql } from 'drizzle-orm'
import type { db } from '../db/client.js'
import { applications, artifacts, releases } from '../db/schema.js'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type ArtifactPublication = Omit<typeof artifacts.$inferInsert, 'id' | 'releaseId'>

/** 上传与构建导入共用的发布事务；文件需已完成大小与 SHA256 校验。 */
export async function createPublishedArtifact(
  tx: Transaction,
  input: ArtifactPublication,
) {
  const now = new Date()
  const [app] = await tx
    .select()
    .from(applications)
    .where(eq(applications.id, input.applicationId))
    .for('update')
    .limit(1)
  if (!app || app.status === 'archived' || app.platform !== input.platform)
    throw new Error('publication_target_changed')
  const [release] = await tx
    .insert(releases)
    .values({
      applicationId: input.applicationId,
      version: input.version,
      releaseNotes: input.releaseNotes,
      createdById: input.uploaderId,
      createdByName: input.uploaderName,
      publishedAt: now,
    })
    .onConflictDoUpdate({
      target: [releases.applicationId, releases.version],
      set: { releaseNotes: input.releaseNotes, updatedAt: now },
    })
    .returning()
  if (input.status === 'latest') {
    await tx.execute(
      sql`UPDATE artifacts SET status = CASE channel WHEN 'beta' THEN 'beta'::artifact_status WHEN 'deprecated' THEN 'deprecated'::artifact_status ELSE 'stable'::artifact_status END, updated_at=now() WHERE application_id=${input.applicationId} AND status='latest'`,
    )
  }
  const [created] = await tx
    .insert(artifacts)
    .values({ ...input, releaseId: release.id })
    .returning()
  return created
}
