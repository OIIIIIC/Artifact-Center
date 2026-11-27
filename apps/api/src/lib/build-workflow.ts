import { and, asc, eq, inArray, isNull, lt, lte, or } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db/client.js'
import {
  applicationBuildConfigs,
  applicationBuilds,
  applications,
  jenkinsConnections,
  users,
} from '../db/schema.js'
import { hasApplicationRole } from '../middleware/application-access.js'
import type { AccessTokenPayload } from './jwt.js'
import { resolveBuildOutputTarget } from './build-output-target.js'
import {
  applicationBuildInput,
  decryptJenkinsToken,
  JenkinsError,
  jenkinsKeyReady,
  testJenkinsJob,
} from './jenkins.js'
import {
  BUILD_REQUEST_PARAMETER,
  cancelJenkinsBuild,
  findJenkinsSubmission,
  readJenkinsBuild,
  readJenkinsQueue,
  triggerJenkinsBuild,
} from './jenkins-build-client.js'

export type BuildRun = typeof applicationBuilds.$inferSelect
export const activeBuildStates = ['pending', 'submitting', 'queued', 'running']
export const startBuildInput = z
  .object({
    requestKey: z.string().uuid(),
    configRevision: z.number().int().positive(),
    parameters: applicationBuildInput.shape.parameters,
    acknowledgeUnknown: z.boolean().optional().default(false),
  })
  .strict()

export function publicBuild(run: BuildRun) {
  return {
    id: run.id,
    applicationId: run.applicationId,
    connectionId: run.connectionId,
    requestedByName: run.requestedByName,
    jobPath: run.jobPath,
    parameters: run.parameters,
    status: run.status,
    queueId: run.queueId,
    buildNumber: run.buildNumber,
    commits: run.commits,
    files: run.files.map((file) => {
      try {
        const target = resolveBuildOutputTarget(run, file.relativePath)
        return {
          ...file,
          targetApplicationId: target.applicationId,
          targetName: target.name,
          targetError: null,
        }
      } catch {
        return {
          ...file,
          targetApplicationId: null,
          targetName: '',
          targetError: '产物未匹配唯一发布目标',
        }
      }
    }),
    error: run.error,
    cancelRequestedAt: run.cancelRequestedAt,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    updatedAt: run.updatedAt,
  }
}

export async function buildCredentials(
  run: Pick<BuildRun, 'baseUrl' | 'username' | 'connectionId'>,
) {
  const [connection] = await db
    .select()
    .from(jenkinsConnections)
    .where(eq(jenkinsConnections.id, run.connectionId))
    .limit(1)
  if (
    !connection?.enabled ||
    connection.baseUrl !== run.baseUrl ||
    connection.username !== run.username
  )
    throw new JenkinsError(
      'jenkins_connection_changed',
      'Jenkins 连接已停用或地址、账号已变更，请管理员恢复原连接后重试',
      409,
    )
  return {
    baseUrl: connection.baseUrl,
    username: connection.username,
    token: decryptJenkinsToken(connection.tokenCiphertext),
  }
}

export async function currentBuildActor(id: string | null, applicationId: string) {
  if (!id)
    throw new JenkinsError(
      'jenkins_actor_forbidden',
      '发起人已不存在或无权操作此应用',
      403,
    )
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (
    !user?.isActive ||
    !(await hasApplicationRole({ sub: id, role: user.role }, applicationId, 'maintainer'))
  )
    throw new JenkinsError(
      'jenkins_actor_forbidden',
      '发起人已停用或已失去应用维护权限',
      403,
    )
  return user
}

export async function enqueueBuild(
  applicationId: string,
  user: AccessTokenPayload,
  input: z.infer<typeof startBuildInput>,
) {
  return db.transaction(async (tx) => {
    const [app] = await tx
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .for('update')
      .limit(1)
    if (!app || app.status === 'archived')
      throw new JenkinsError('archived_application', '应用已归档', 409)
    const [existing] = await tx
      .select()
      .from(applicationBuilds)
      .where(
        and(
          eq(applicationBuilds.applicationId, applicationId),
          eq(applicationBuilds.requestKey, input.requestKey),
        ),
      )
      .limit(1)
    if (existing) {
      if (
        existing.requestedById !== user.sub ||
        existing.configRevision !== input.configRevision ||
        JSON.stringify(existing.parameters) !== JSON.stringify(input.parameters)
      )
        throw new JenkinsError(
          'jenkins_request_conflict',
          '同一请求编号不能用于不同构建参数',
          409,
        )
      return existing
    }
    const [active] = await tx
      .select({ id: applicationBuilds.id })
      .from(applicationBuilds)
      .where(
        and(
          eq(applicationBuilds.applicationId, applicationId),
          inArray(applicationBuilds.status, activeBuildStates),
        ),
      )
      .limit(1)
    if (active)
      throw new JenkinsError(
        'jenkins_build_active',
        '此应用已有构建正在执行，请等待或取消后再发起',
        409,
      )
    const [unknown] = await tx
      .select({ id: applicationBuilds.id })
      .from(applicationBuilds)
      .where(
        and(
          eq(applicationBuilds.applicationId, applicationId),
          eq(applicationBuilds.status, 'unknown'),
        ),
      )
      .limit(1)
    if (unknown && !input.acknowledgeUnknown)
      throw new JenkinsError(
        'jenkins_unconfirmed_build',
        '存在提交结果未确认的构建，请先核对 Jenkins，确认后再发起新构建',
        409,
      )
    const [config] = await tx
      .select()
      .from(applicationBuildConfigs)
      .where(eq(applicationBuildConfigs.applicationId, applicationId))
      .limit(1)
    const [connection] = await tx
      .select()
      .from(jenkinsConnections)
      .where(eq(jenkinsConnections.id, config?.connectionId ?? 'default'))
      .limit(1)
    if (!config?.enabled || !connection?.enabled || !jenkinsKeyReady())
      throw new JenkinsError(
        'jenkins_not_configured',
        '请先启用应用构建配置和 Jenkins 连接',
        409,
      )
    if (config.revision !== input.configRevision)
      throw new JenkinsError(
        'jenkins_config_conflict',
        '构建配置已更新，请重新加载后发起',
        409,
      )
    // 普通维护者只能调整管理员配置过的参数值，不能引入新的任务参数。
    const names = new Set(config.parameters.map((parameter) => parameter.name))
    if (
      input.parameters.length !== config.parameters.length ||
      input.parameters.some((p) => !names.has(p.name))
    )
      throw new JenkinsError('jenkins_invalid_parameter', '只能使用管理员已配置的参数')
    const [created] = await tx
      .insert(applicationBuilds)
      .values({
        applicationId,
        requestKey: input.requestKey,
        requestedById: user.sub,
        requestedByName: user.name,
        connectionId: connection.id,
        baseUrl: connection.baseUrl,
        username: connection.username,
        jobPath: config.jobPath,
        configRevision: config.revision,
        artifactPattern: config.artifactPattern,
        outputTargets: config.outputTargets,
        parameters: input.parameters,
      })
      .returning()
    return created
  })
}

export async function requestBuildCancellation(run: BuildRun) {
  if (!activeBuildStates.includes(run.status) && run.status !== 'unknown')
    throw new JenkinsError('jenkins_build_finished', '此构建已经结束', 409)
  // 只记录意图；工作器串行协调队列转为构建时的竞争。
  const [updated] = await db
    .update(applicationBuilds)
    .set({ cancelRequestedAt: new Date(), nextSyncAt: new Date() })
    .where(
      and(
        eq(applicationBuilds.id, run.id),
        inArray(applicationBuilds.status, [...activeBuildStates, 'unknown']),
      ),
    )
    .returning()
  return updated ?? run
}

async function saveRun(
  run: BuildRun,
  values: Partial<typeof applicationBuilds.$inferInsert>,
) {
  const patch = {
    ...values,
    leaseId: null,
    leaseUntil: null,
    updatedAt: new Date(),
    nextSyncAt: new Date(Date.now() + 5000),
  }
  const where = and(
    eq(applicationBuilds.id, run.id),
    eq(applicationBuilds.leaseId, run.leaseId!),
  )
  try {
    await db.update(applicationBuilds).set(patch).where(where)
  } catch (error) {
    // 一个未确认的旧构建可能在用户明确发起新构建后才被发现。
    const pgError = error as { code?: string; cause?: { code?: string } }
    if (
      (pgError.code === '23505' || pgError.cause?.code === '23505') &&
      run.status === 'unknown' &&
      ['queued', 'running'].includes(String(values.status))
    ) {
      await db
        .update(applicationBuilds)
        .set({
          ...patch,
          status: 'unknown',
          error: '已找到先前提交的构建，仍在执行；同时存在较新的构建请求',
        })
        .where(where)
    } else throw error
  }
}

export async function syncBuild(run: BuildRun) {
  let submitting = false
  try {
    if (run.status === 'pending' && run.cancelRequestedAt) {
      await saveRun(run, { status: 'aborted', finishedAt: new Date(), error: null })
      return
    }
    const auth = await buildCredentials(run)
    if (run.status === 'pending') {
      await currentBuildActor(run.requestedById, run.applicationId)
      const [app] = await db
        .select()
        .from(applications)
        .where(eq(applications.id, run.applicationId))
        .limit(1)
      const [config] = await db
        .select()
        .from(applicationBuildConfigs)
        .where(eq(applicationBuildConfigs.applicationId, run.applicationId))
        .limit(1)
      if (
        !app ||
        app.status === 'archived' ||
        !config?.enabled ||
        config.revision !== run.configRevision
      )
        throw new JenkinsError(
          'jenkins_config_changed',
          '应用或构建配置已更改，此次请求未提交，请重新发起',
          409,
        )
      const job = await testJenkinsJob(auth, { ...config, parameters: run.parameters })
      const tracking = job.parameters.find(
        (parameter) => parameter.name === BUILD_REQUEST_PARAMETER,
      )
      if (tracking && tracking.type !== 'StringParameterDefinition')
        throw new JenkinsError(
          'jenkins_tracking_parameter',
          'ARTIFACT_CENTER_REQUEST_ID 必须为 String 参数',
        )
      const [claimed] = await db
        .update(applicationBuilds)
        .set({ status: 'submitting', updatedAt: new Date() })
        .where(
          and(
            eq(applicationBuilds.id, run.id),
            eq(applicationBuilds.leaseId, run.leaseId!),
            isNull(applicationBuilds.cancelRequestedAt),
          ),
        )
        .returning()
      if (!claimed) {
        await saveRun(run, { status: 'aborted', finishedAt: new Date() })
        return
      }
      submitting = true
      const queueId = await triggerJenkinsBuild(
        auth,
        run.jobPath,
        run.parameters,
        job.parameters.length > 0,
        run.id,
        Boolean(tracking),
      )
      await saveRun(run, { queueId, status: 'queued', error: null })
      return
    }
    // 提交中状态被其他工作器接管意味着前一个进程中断，只核对，不重发。
    if (
      run.status === 'submitting' ||
      (run.queueId === null && run.buildNumber === null)
    ) {
      const found = await findJenkinsSubmission(auth, run.jobPath, run.id, null)
      if (!found) {
        await saveRun(run, {
          status: 'unknown',
          error: '提交结果未确认；系统不会重复提交。请核对 Jenkins 队列和任务历史',
        })
        return
      }
      run = { ...run, ...found }
    }
    if (run.buildNumber === null && run.queueId !== null) {
      try {
        const queue = await readJenkinsQueue(auth, run.queueId)
        if (queue.cancelled) {
          await saveRun(run, { status: 'aborted', finishedAt: new Date(), error: null })
          return
        }
        if (queue.executable) run = { ...run, buildNumber: queue.executable.number }
        else {
          if (run.cancelRequestedAt)
            await cancelJenkinsBuild(auth, run.jobPath, null, run.queueId)
          await saveRun(run, {
            status: 'queued',
            queueId: run.queueId,
            error: queue.why?.slice(0, 1000) ?? null,
          })
          return
        }
      } catch (error) {
        if (!(error instanceof JenkinsError) || error.code !== 'jenkins_not_found')
          throw error
        const found = await findJenkinsSubmission(auth, run.jobPath, run.id, run.queueId)
        if (!found) {
          await saveRun(run, {
            status: 'unknown',
            queueId: run.queueId,
            error: '队列记录已消失，尚未找到对应构建；请核对 Jenkins',
          })
          return
        }
        run = { ...run, ...found }
      }
    }
    if (run.buildNumber === null) return
    const build = await readJenkinsBuild(
      auth,
      run.jobPath,
      run.buildNumber,
      run.queueId,
      run.artifactPattern,
    )
    if (run.cancelRequestedAt && build.building)
      await cancelJenkinsBuild(auth, run.jobPath, run.buildNumber, run.queueId)
    const status = build.building
      ? 'running'
      : ({
          SUCCESS: 'success',
          FAILURE: 'failure',
          UNSTABLE: 'unstable',
          ABORTED: 'aborted',
          NOT_BUILT: 'failure',
        }[build.result ?? ''] ?? 'unknown')
    await saveRun(run, {
      status,
      queueId: run.queueId,
      buildNumber: build.number,
      startedAt: new Date(build.timestamp),
      finishedAt: build.building ? null : new Date(build.timestamp + build.duration),
      commits: build.commits,
      files: build.building ? [] : build.artifacts,
      error: null,
    })
  } catch (error) {
    const message =
      error instanceof JenkinsError ? error.message : '同步 Jenkins 状态失败，请稍后刷新'
    const rejected =
      error instanceof JenkinsError && error.code === 'jenkins_build_rejected'
    await saveRun(run, {
      status:
        submitting && !rejected
          ? 'unknown'
          : run.status === 'pending'
            ? 'failure'
            : run.status === 'submitting'
              ? 'unknown'
              : run.status,
      error: message,
      ...(run.status === 'pending' && (!submitting || rejected)
        ? { finishedAt: new Date() }
        : {}),
    })
  }
}

export async function processBuildQueue() {
  const now = new Date()
  const available = and(
    inArray(applicationBuilds.status, [...activeBuildStates, 'unknown']),
    lte(applicationBuilds.nextSyncAt, now),
    or(isNull(applicationBuilds.leaseUntil), lt(applicationBuilds.leaseUntil, now)),
  )
  const candidates = await db
    .select({ id: applicationBuilds.id })
    .from(applicationBuilds)
    .where(available)
    .orderBy(asc(applicationBuilds.nextSyncAt))
    .limit(10)
  for (const candidate of candidates) {
    const [run] = await db
      .update(applicationBuilds)
      .set({ leaseId: randomUUID(), leaseUntil: new Date(Date.now() + 90_000) })
      .where(and(eq(applicationBuilds.id, candidate.id), available))
      .returning()
    if (run) await syncBuild(run)
  }
}
