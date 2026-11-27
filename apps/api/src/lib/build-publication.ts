import { and, asc, eq, inArray, isNull, lt, or } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { db } from '../db/client.js'
import {
  applicationBuilds,
  applications,
  buildPublications,
  projects,
  regions,
} from '../db/schema.js'
import { distributionFilename } from './artifact-filename.js'
import { platformForArtifactType, resolveArtifactType } from './artifact-types.js'
import { buildCredentials, currentBuildActor, type BuildRun } from './build-workflow.js'
import { JenkinsError } from './jenkins.js'
import { MAX_BUILD_ARTIFACT_BYTES, openJenkinsArtifact } from './jenkins-build-client.js'
import { createPublishedArtifact } from './publish-artifact.js'
import { enforceRetentionAfterUpload } from './retention.js'
import { deleteStorageFile, saveUploadStream } from './storage.js'
import { reserveUploadCapacity } from './upload-capacity.js'
import type { AccessTokenPayload } from './jwt.js'
import { auditLogs } from '../db/schema.js'
import { resolveBuildOutputTarget } from './build-output-target.js'

export const publishBuildInput = z
  .object({
    relativePath: z.string().min(1).max(1000),
    version: z.string().trim().min(1).max(64),
    channel: z.enum(['beta', 'stable']).default('beta'),
    releaseNotes: z.string().max(8000).default(''),
    confirmStable: z.boolean().default(false),
  })
  .strict()
type Publication = typeof buildPublications.$inferSelect

export function publicPublication(row: Publication) {
  return {
    id: row.id,
    buildId: row.buildId,
    relativePath: row.relativePath,
    targetApplicationId: row.targetApplicationId,
    version: row.version,
    channel: row.channel,
    releaseNotes: row.releaseNotes,
    status: row.status,
    artifactId: row.artifactId,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function selectedBuildFile(run: BuildRun, relativePath: string) {
  const file = run.files.find((item) => item.relativePath === relativePath)
  if (run.status !== 'success' || run.buildNumber === null || !file)
    throw new JenkinsError(
      'jenkins_artifact_not_ready',
      '仅可下载或发布成功构建中已归档且匹配规则的产物',
      409,
    )
  return file
}

export async function enqueueBuildPublication(
  run: BuildRun,
  user: AccessTokenPayload,
  input: z.infer<typeof publishBuildInput>,
) {
  const file = selectedBuildFile(run, input.relativePath)
  const target = resolveBuildOutputTarget(run, file.relativePath)
  await currentBuildActor(user.sub, target.applicationId)
  if (input.channel === 'stable' && !input.confirmStable)
    throw new JenkinsError('jenkins_stable_confirmation', '请确认发布为正式版')
  const type = resolveArtifactType(file.fileName)
  const [app] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, target.applicationId))
    .limit(1)
  if (!app || app.status === 'archived')
    throw new JenkinsError('archived_application', '应用已归档', 409)
  if (!type || platformForArtifactType(type) !== app.platform)
    throw new JenkinsError('platform_mismatch', '产物类型不匹配应用平台', 400)
  const values = {
    buildId: run.id,
    targetApplicationId: target.applicationId,
    relativePath: input.relativePath,
    version: input.version,
    channel: input.channel,
    releaseNotes: input.releaseNotes,
    requestedById: user.sub,
    requestedByName: user.name,
  }
  const [created] = await db
    .insert(buildPublications)
    .values(values)
    .onConflictDoNothing()
    .returning()
  if (created) return created
  const [existing] = await db
    .select()
    .from(buildPublications)
    .where(
      and(
        eq(buildPublications.buildId, run.id),
        eq(buildPublications.relativePath, input.relativePath),
      ),
    )
    .limit(1)
  if (existing.status === 'failed') {
    const [retried] = await db
      .update(buildPublications)
      .set({ ...values, status: 'pending', error: null, updatedAt: new Date() })
      .where(
        and(
          eq(buildPublications.id, existing.id),
          eq(buildPublications.status, 'failed'),
        ),
      )
      .returning()
    if (retried) return retried
    throw new JenkinsError(
      'jenkins_publish_conflict',
      '其他人已重新提交此产物，请刷新查看',
      409,
    )
  }
  if (
    existing.version !== input.version ||
    (existing.targetApplicationId ?? run.applicationId) !== target.applicationId ||
    existing.channel !== input.channel ||
    existing.releaseNotes !== input.releaseNotes
  )
    throw new JenkinsError(
      'jenkins_publish_conflict',
      '此产物已按其他发布信息提交，请刷新查看',
      409,
    )
  return existing
}

function isDuplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (('code' in error && error.code === '23505') ||
      ('cause' in error && isDuplicate(error.cause)))
  )
}

export async function importBuildPublication(publication: Publication) {
  const ownsLease = and(
    eq(buildPublications.id, publication.id),
    eq(buildPublications.leaseId, publication.leaseId!),
  )
  let releaseCapacity: (() => void) | undefined
  let remote: Awaited<ReturnType<typeof openJenkinsArtifact>> | undefined
  let committed = false
  const storageKey = publication.storageKey!
  try {
    const [run] = await db
      .select()
      .from(applicationBuilds)
      .where(eq(applicationBuilds.id, publication.buildId))
      .limit(1)
    if (!run) throw new JenkinsError('jenkins_build_missing', '构建记录不存在', 404)
    const file = selectedBuildFile(run, publication.relativePath)
    const user = await currentBuildActor(publication.requestedById, run.applicationId)
    const targetApplicationId = publication.targetApplicationId ?? run.applicationId
    if (
      resolveBuildOutputTarget(run, file.relativePath).applicationId !==
      targetApplicationId
    )
      throw new JenkinsError('jenkins_target_changed', '发布目标与构建快照不一致', 409)
    await currentBuildActor(publication.requestedById, targetApplicationId)
    const auth = await buildCredentials(run)
    remote = await openJenkinsArtifact(
      auth,
      run.jobPath,
      run.buildNumber!,
      file.relativePath,
    )
    const reservation = await reserveUploadCapacity(
      remote.sizeBytes ?? MAX_BUILD_ARTIFACT_BYTES,
    )
    if (!reservation.accepted)
      throw new JenkinsError(
        reservation.reason,
        '存储空间或配额不足，无法导入构建产物',
        507,
      )
    releaseCapacity = reservation.release
    const saved = await saveUploadStream(
      storageKey,
      Readable.fromWeb(remote.stream as import('node:stream/web').ReadableStream),
    )
    if (!saved.sizeBytes) throw new JenkinsError('empty_file', '构建产物为空')
    // 传输结束后重新检查用户、应用状态，再以同一事务完成入库和关联。
    await currentBuildActor(publication.requestedById, run.applicationId)
    await currentBuildActor(publication.requestedById, targetApplicationId)
    const artifact = await db.transaction(async (tx) => {
      const [owned] = await tx
        .select()
        .from(buildPublications)
        .where(ownsLease)
        .for('update')
        .limit(1)
      if (!owned || owned.status !== 'importing')
        throw new JenkinsError(
          'jenkins_import_reclaimed',
          '导入任务已由其他工作器接管',
          409,
        )
      const [target] = await tx
        .select({
          app: applications,
          regionCode: regions.code,
          projectCode: projects.code,
        })
        .from(applications)
        .innerJoin(regions, eq(regions.id, applications.regionId))
        .innerJoin(projects, eq(projects.id, applications.projectId))
        .where(eq(applications.id, targetApplicationId))
        .limit(1)
      const type = resolveArtifactType(file.fileName)
      if (
        !target ||
        !type ||
        platformForArtifactType(type) !== target.app.platform ||
        target.app.status === 'archived'
      )
        throw new JenkinsError(
          'jenkins_target_changed',
          '应用已归档或平台已变更，已停止发布',
          409,
        )
      const channel = publication.channel as 'beta' | 'stable'
      const filename = distributionFilename({
        regionCode: target.regionCode,
        projectCode: target.projectCode,
        applicationCode: target.app.applicationCode,
        version: publication.version,
        buildNumber: String(run.buildNumber),
        channel,
        originalFilename: file.fileName,
      })
      const created = await createPublishedArtifact(tx, {
        applicationId: targetApplicationId,
        version: publication.version,
        buildNumber: String(run.buildNumber),
        platform: target.app.platform,
        type,
        channel,
        status: channel,
        originalFilename: file.fileName,
        filename,
        sizeBytes: saved.sizeBytes,
        sha256: saved.sha256,
        storageKey,
        storageBackend: 'local',
        releaseNotes: publication.releaseNotes,
        uploaderId: user.id,
        uploaderName: user.name,
        buildMeta: {
          provider: 'jenkins',
          sourceApplicationId: run.applicationId,
          buildId: run.id,
          jobPath: run.jobPath,
          buildNumber: run.buildNumber,
          queueId: run.queueId,
          commits: run.commits,
          relativePath: file.relativePath,
        },
      })
      await tx
        .update(buildPublications)
        .set({
          status: 'published',
          artifactId: created.id,
          error: null,
          leaseId: null,
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(ownsLease)
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorName: user.name,
        action: 'artifact.upload',
        objectType: 'artifact',
        objectId: created.id,
        applicationId: targetApplicationId,
        summary: `从 Jenkins 构建 #${run.buildNumber} 发布 ${filename}`,
        meta: {
          via: 'jenkins',
          buildId: run.id,
          sha256: saved.sha256,
          sizeBytes: saved.sizeBytes,
          channel,
          markLatest: false,
        },
      })
      return created
    })
    committed = true
    // 发布事务完成后，保留策略故障不能把已成功的任务改成失败。
    await enforceRetentionAfterUpload(artifact.applicationId).catch(() => undefined)
  } catch (error) {
    if (!committed) {
      await deleteStorageFile(storageKey).catch(() => undefined)
      await db
        .update(buildPublications)
        .set({
          status: 'failed',
          storageKey: null,
          leaseId: null,
          leaseUntil: null,
          error: isDuplicate(error)
            ? '此版本、文件类型和构建号已存在，请修改版本后重试'
            : error instanceof JenkinsError
              ? error.message
              : '产物导入失败，请检查 Jenkins 文件和存储后重试',
          updatedAt: new Date(),
        })
        .where(ownsLease)
    }
  } finally {
    releaseCapacity?.()
    await remote?.close()
  }
}

export async function processBuildPublications() {
  const now = new Date()
  const available = and(
    inArray(buildPublications.status, ['pending', 'importing']),
    or(isNull(buildPublications.leaseUntil), lt(buildPublications.leaseUntil, now)),
  )
  const [candidate] = await db
    .select()
    .from(buildPublications)
    .where(available)
    .orderBy(asc(buildPublications.createdAt))
    .limit(1)
  if (!candidate) return
  const [run] = await db
    .select()
    .from(applicationBuilds)
    .where(eq(applicationBuilds.id, candidate.buildId))
    .limit(1)
  if (!run) return
  // 每次接管使用新的文件名，前一个进程即使迟到也不能覆盖当前产物。
  const storageKey = `${candidate.targetApplicationId ?? run.applicationId}/jenkins-${randomUUID()}`
  const [claimed] = await db
    .update(buildPublications)
    .set({
      status: 'importing',
      storageKey,
      leaseId: randomUUID(),
      leaseUntil: new Date(Date.now() + 6 * 60_000),
      updatedAt: now,
    })
    .where(and(eq(buildPublications.id, candidate.id), available))
    .returning()
  if (!claimed) return
  if (candidate.storageKey)
    await deleteStorageFile(candidate.storageKey).catch(() => undefined)
  await importBuildPublication(claimed)
}
