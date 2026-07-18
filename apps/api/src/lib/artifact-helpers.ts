import { desc, eq, sql } from 'drizzle-orm'

import { db } from '../db/client.js'
import { applications, artifacts } from '../db/schema.js'

/** Demote all "latest" in an app to channel baseline status */
export async function demoteLatestInApp(applicationId: string) {
  await db.execute(sql`
    UPDATE artifacts
    SET status = CASE channel
      WHEN 'beta' THEN 'beta'::artifact_status
      WHEN 'deprecated' THEN 'deprecated'::artifact_status
      ELSE 'stable'::artifact_status
    END
    WHERE application_id = ${applicationId}
      AND status = 'latest'
  `)
}

export function statusFromChannel(
  channel: 'stable' | 'beta' | 'internal' | 'deprecated',
): 'stable' | 'beta' | 'deprecated' {
  if (channel === 'beta') return 'beta'
  if (channel === 'deprecated') return 'deprecated'
  return 'stable'
}

/** Recount artifacts + sync latestVersion from remaining latest/first row */
export async function refreshApplicationArtifactStats(applicationId: string) {
  const all = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.applicationId, applicationId))
    .orderBy(desc(artifacts.uploadedAt))

  const latest = all.find((a) => a.status === 'latest') ?? all[0] ?? null

  await db
    .update(applications)
    .set({
      artifactCount: all.length,
      latestVersion: latest?.version ?? '',
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId))

  return { count: all.length, latestVersion: latest?.version ?? '', latest }
}
