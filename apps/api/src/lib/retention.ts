import { and, asc, eq, ne, or, sql } from 'drizzle-orm'

import { db } from '../db/client.js'
import {
  applications,
  artifacts,
  retentionSettings,
  type RetentionSettings,
} from '../db/schema.js'
import { refreshApplicationArtifactStats } from './artifact-helpers.js'
import { deleteStorageFile, getStorageDiskSpace } from './storage.js'

const DEFAULT_ID = 'default'

export type RetentionPolicyDto = {
  maxVersions: number
  archiveDeprecatedDays: number
  artifactStorageBytes: number
  diskTotalBytes: number | null
  diskUsedBytes: number | null
  diskFreeBytes: number | null
  measuredAt: string
  updatedAt: string
}

export type CleanupReport = {
  deletedVersions: number
  archivedDeprecated: number
  applicationsTouched: number
}

export async function ensureRetentionSettings(): Promise<RetentionSettings> {
  const [existing] = await db
    .select()
    .from(retentionSettings)
    .where(eq(retentionSettings.id, DEFAULT_ID))
    .limit(1)
  if (existing) return existing

  try {
    const [created] = await db
      .insert(retentionSettings)
      .values({ id: DEFAULT_ID })
      .returning()
    if (created) return created
  } catch {
    // race: another process inserted
  }

  const [again] = await db
    .select()
    .from(retentionSettings)
    .where(eq(retentionSettings.id, DEFAULT_ID))
    .limit(1)
  return again!
}

export async function getStorageUsedBytes(): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${artifacts.sizeBytes}), 0)` })
    .from(artifacts)
  return Number(row?.total ?? 0)
}

export async function getRetentionPolicy(): Promise<RetentionPolicyDto> {
  const s = await ensureRetentionSettings()
  const [artifactStorageBytes, diskSpace] = await Promise.all([
    getStorageUsedBytes(),
    getStorageDiskSpace(),
  ])
  return {
    maxVersions: s.maxVersions,
    archiveDeprecatedDays: s.archiveDeprecatedDays,
    artifactStorageBytes,
    diskTotalBytes: diskSpace?.totalBytes ?? null,
    diskUsedBytes: diskSpace?.usedBytes ?? null,
    diskFreeBytes: diskSpace?.freeBytes ?? null,
    measuredAt: new Date().toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export async function updateRetentionSettings(input: {
  maxVersions?: number
  archiveDeprecatedDays?: number
}): Promise<RetentionPolicyDto> {
  await ensureRetentionSettings()
  const [row] = await db
    .update(retentionSettings)
    .set({
      ...(input.maxVersions !== undefined ? { maxVersions: input.maxVersions } : {}),
      ...(input.archiveDeprecatedDays !== undefined
        ? { archiveDeprecatedDays: input.archiveDeprecatedDays }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(retentionSettings.id, DEFAULT_ID))
    .returning()

  const [artifactStorageBytes, diskSpace] = await Promise.all([
    getStorageUsedBytes(),
    getStorageDiskSpace(),
  ])
  return {
    maxVersions: row.maxVersions,
    archiveDeprecatedDays: row.archiveDeprecatedDays,
    artifactStorageBytes,
    diskTotalBytes: diskSpace?.totalBytes ?? null,
    diskUsedBytes: diskSpace?.usedBytes ?? null,
    diskFreeBytes: diskSpace?.freeBytes ?? null,
    measuredAt: new Date().toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Enforce max-versions for one application: delete oldest non-latest first.
 */
export async function enforceMaxVersionsForApp(
  applicationId: string,
  maxVersions: number,
): Promise<number> {
  if (maxVersions < 1) return 0

  const rows = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.applicationId, applicationId))
    .orderBy(asc(artifacts.uploadedAt))

  if (rows.length <= maxVersions) return 0

  // Delete non-latest oldest first; only touch "latest" if still over limit
  const latest = rows.filter((r) => r.status === 'latest')
  const others = rows.filter((r) => r.status !== 'latest')
  const ordered = [...others, ...latest]

  const toDeleteCount = rows.length - maxVersions
  const victims = ordered.slice(0, toDeleteCount)
  let deleted = 0

  for (const v of victims) {
    await db.delete(artifacts).where(eq(artifacts.id, v.id))
    await deleteStorageFile(v.storageKey)
    deleted += 1
  }

  if (deleted > 0) {
    await refreshApplicationArtifactStats(applicationId)
  }
  return deleted
}

/**
 * Soft-archive deprecated artifacts older than N days.
 */
export async function archiveOldDeprecated(
  archiveDeprecatedDays: number,
): Promise<number> {
  if (archiveDeprecatedDays < 1) return 0

  const cutoffMs = Date.now() - archiveDeprecatedDays * 24 * 60 * 60 * 1000

  const candidates = await db
    .select()
    .from(artifacts)
    .where(
      and(
        ne(artifacts.status, 'archived'),
        or(eq(artifacts.status, 'deprecated'), eq(artifacts.channel, 'deprecated')),
      ),
    )

  let archived = 0
  const appIds = new Set<string>()

  for (const row of candidates) {
    if (row.status === 'latest') continue
    const when = row.deprecatedAt ?? row.uploadedAt
    if (when.getTime() > cutoffMs) continue

    await db.update(artifacts).set({ status: 'archived' }).where(eq(artifacts.id, row.id))
    archived += 1
    appIds.add(row.applicationId)
  }

  for (const appId of appIds) {
    await refreshApplicationArtifactStats(appId)
  }

  return archived
}

/** Full cleanup across all applications */
export async function runRetentionCleanup(): Promise<CleanupReport> {
  const settings = await ensureRetentionSettings()
  const apps = await db.select({ id: applications.id }).from(applications)

  let deletedVersions = 0
  let applicationsTouched = 0

  for (const app of apps) {
    const n = await enforceMaxVersionsForApp(app.id, settings.maxVersions)
    if (n > 0) {
      deletedVersions += n
      applicationsTouched += 1
    }
  }

  const archivedDeprecated = await archiveOldDeprecated(settings.archiveDeprecatedDays)

  return {
    deletedVersions,
    archivedDeprecated,
    applicationsTouched,
  }
}

/** After upload: only enforce max-versions for that app */
export async function enforceRetentionAfterUpload(applicationId: string): Promise<void> {
  try {
    const settings = await ensureRetentionSettings()
    await enforceMaxVersionsForApp(applicationId, settings.maxVersions)
  } catch (err) {
    console.error('[retention] post-upload enforce failed', err)
  }
}
