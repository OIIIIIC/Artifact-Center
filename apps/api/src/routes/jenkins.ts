import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client.js'
import {
  applicationBuildConfigs,
  applications,
  jenkinsConnections,
} from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import {
  applicationBuildInput,
  decryptJenkinsToken,
  encryptJenkinsToken,
  JenkinsError,
  jenkinsConnectionInput,
  jenkinsKeyReady,
  testJenkinsConnection,
  testJenkinsJob,
} from '../lib/jenkins.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { requireRoles } from '../middleware/require-role.js'
import { hasApplicationRole } from '../middleware/application-access.js'

type Connection = typeof jenkinsConnections.$inferSelect
const connectionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/)
const getConnection = async (id = 'default') =>
  (
    await db
      .select()
      .from(jenkinsConnections)
      .where(eq(jenkinsConnections.id, id))
      .limit(1)
  )[0]
const publicConnection = (row: Connection | undefined) =>
  row
    ? {
        id: row.id,
        name: row.name,
        baseUrl: row.baseUrl,
        username: row.username,
        enabled: row.enabled,
        hasToken: Boolean(row.tokenCiphertext),
        revision: row.revision,
        updatedAt: row.updatedAt.toISOString(),
      }
    : null

function credentials(
  input: z.infer<typeof jenkinsConnectionInput>,
  current: Connection | undefined,
) {
  if (input.revision !== (current?.revision ?? 0))
    throw new JenkinsError(
      'jenkins_config_conflict',
      '配置已被其他人修改，请重新加载后再操作',
      409,
    )
  if (
    !input.token &&
    (!current || input.baseUrl !== current.baseUrl || input.username !== current.username)
  ) {
    throw new JenkinsError(
      'jenkins_token_required',
      '首次配置或修改地址、账号时，请重新填写 API Token',
    )
  }
  return {
    baseUrl: input.baseUrl,
    username: input.username,
    token: input.token ?? decryptJenkinsToken(current!.tokenCiphertext),
  }
}

function handleErrors(app: Hono<{ Variables: AuthVariables }>) {
  app.onError((error, c) => {
    if (error instanceof JenkinsError)
      return jsonError(c, error.status, error.code, error.message)
    // 不记录原始异常，避免数据库参数或请求头中的凭据进入日志。
    return jsonError(c, 500, 'internal_error', '服务器处理请求时发生错误')
  })
}

export const jenkinsSettingsRoutes = new Hono<{ Variables: AuthVariables }>()
jenkinsSettingsRoutes.use('*', requireAuth, requireRoles('admin'))
handleErrors(jenkinsSettingsRoutes)
jenkinsSettingsRoutes.get('/', async (c) => {
  c.header('Cache-Control', 'no-store')
  return c.json({
    connection: publicConnection(await getConnection()),
    connections: (
      await db.select().from(jenkinsConnections).orderBy(asc(jenkinsConnections.id))
    ).map(publicConnection),
    keyReady: jenkinsKeyReady(),
  })
})
jenkinsSettingsRoutes.post('/test', async (c) => {
  const input = jenkinsConnectionInput.safeParse(await c.req.json().catch(() => null))
  if (!input.success) return jsonError(c, 400, 'invalid_body', '连接配置无效')
  return c.json(
    await testJenkinsConnection(credentials(input.data, await getConnection())),
  )
})
jenkinsSettingsRoutes.post('/connections/:connectionId/test', async (c) => {
  const id = connectionIdSchema.safeParse(c.req.param('connectionId'))
  if (!id.success) return jsonError(c, 400, 'invalid_body', '连接 ID 无效')
  const input = jenkinsConnectionInput.safeParse(await c.req.json().catch(() => null))
  if (!input.success) return jsonError(c, 400, 'invalid_body', '连接配置无效')
  return c.json(
    await testJenkinsConnection(credentials(input.data, await getConnection(id.data))),
  )
})
jenkinsSettingsRoutes.put('/connections/:connectionId', saveConnection)
jenkinsSettingsRoutes.put('/', saveConnection)

async function saveConnection(c: import('hono').Context<{ Variables: AuthVariables }>) {
  const id = connectionIdSchema.safeParse(c.req.param('connectionId') ?? 'default')
  if (!id.success) return jsonError(c, 400, 'invalid_body', '连接 ID 无效')
  const input = jenkinsConnectionInput.safeParse(await c.req.json().catch(() => null))
  if (!input.success) return jsonError(c, 400, 'invalid_body', '连接配置无效')
  const current = await getConnection(id.data)
  const auth = credentials(input.data, current)
  const values = {
    id: id.data,
    name: input.data.name ?? current?.name ?? 'Jenkins',
    baseUrl: auth.baseUrl,
    username: auth.username,
    tokenCiphertext: input.data.token
      ? encryptJenkinsToken(auth.token)
      : current!.tokenCiphertext,
    enabled: input.data.enabled,
    revision: input.data.revision + 1,
    updatedAt: new Date(),
  }
  // 启用前必须确认服务和凭据可用；停用可在 Jenkins 离线时完成。
  if (values.enabled) await testJenkinsConnection(auth)
  const [saved] = current
    ? await db
        .update(jenkinsConnections)
        .set(values)
        .where(
          and(
            eq(jenkinsConnections.id, id.data),
            eq(jenkinsConnections.revision, input.data.revision),
          ),
        )
        .returning()
    : await db.insert(jenkinsConnections).values(values).onConflictDoNothing().returning()
  if (!saved)
    throw new JenkinsError(
      'jenkins_config_conflict',
      '配置已被其他人修改，请重新加载后再操作',
      409,
    )
  await writeAudit(c, {
    action: 'settings.jenkins_update',
    objectType: 'system',
    objectId: id.data,
    summary: '更新 Jenkins 连接配置',
    meta: {
      connectionId: id.data,
      enabled: saved.enabled,
      tokenChanged: Boolean(input.data.token),
    },
  })
  c.header('Cache-Control', 'no-store')
  return c.json({ connection: publicConnection(saved), keyReady: jenkinsKeyReady() })
}

export const applicationBuildRoutes = new Hono<{ Variables: AuthVariables }>()
function publicBuildConfig(config: typeof applicationBuildConfigs.$inferSelect) {
  const parameterChoices = config.parameters.flatMap(({ name, choices }) =>
    choices?.length ? [{ name, choices }] : [],
  )
  return {
    ...config,
    parameters: config.parameters.map(({ name, value }) => ({ name, value })),
    ...(parameterChoices.length ? { parameterChoices } : {}),
  }
}

applicationBuildRoutes.use('/:appId/build-config/*', requireAuth)
handleErrors(applicationBuildRoutes)
applicationBuildRoutes.use('/:appId/build-config/*', async (c, next) => {
  const id = c.req.param('appId')
  if (!z.string().uuid().safeParse(id).success)
    return jsonError(c, 400, 'invalid_body', '应用 ID 无效')
  if (!(await hasApplicationRole(c.get('user'), id, 'maintainer')))
    return jsonError(c, 403, 'forbidden', '无权管理此应用')
  const [app] = await db
    .select({ status: applications.status })
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1)
  if (!app) return jsonError(c, 404, 'not_found', '应用不存在')
  if (c.req.method !== 'GET' && app.status === 'archived')
    return jsonError(c, 409, 'archived_application', '应用已归档')
  await next()
})
applicationBuildRoutes.get('/:appId/build-config', async (c) => {
  const [config] = await db
    .select()
    .from(applicationBuildConfigs)
    .where(eq(applicationBuildConfigs.applicationId, c.req.param('appId')))
    .limit(1)
  const connection = await getConnection(config?.connectionId ?? 'default')
  c.header('Cache-Control', 'no-store')
  return c.json({
    config: config ? publicBuildConfig(config) : null,
    connectionReady: Boolean(connection?.enabled && jenkinsKeyReady()),
    keyReady: jenkinsKeyReady(),
    connections: await db
      .select({
        id: jenkinsConnections.id,
        name: jenkinsConnections.name,
        enabled: jenkinsConnections.enabled,
      })
      .from(jenkinsConnections)
      .orderBy(asc(jenkinsConnections.id)),
  })
})

async function verifyJob(input: z.infer<typeof applicationBuildInput>) {
  const connection = await getConnection(input.connectionId ?? 'default')
  if (!connection?.enabled)
    throw new JenkinsError(
      'jenkins_not_configured',
      '请先由管理员配置并启用 Jenkins 连接',
      409,
    )
  return testJenkinsJob(
    { ...connection, token: decryptJenkinsToken(connection.tokenCiphertext) },
    input,
  )
}

applicationBuildRoutes.post(
  '/:appId/build-config/test',
  requireRoles('admin'),
  async (c) => {
    const input = applicationBuildInput.safeParse(await c.req.json().catch(() => null))
    if (!input.success) return jsonError(c, 400, 'invalid_body', '构建配置无效')
    return c.json(await verifyJob(input.data))
  },
)
applicationBuildRoutes.put('/:appId/build-config', requireRoles('admin'), async (c) => {
  const input = applicationBuildInput.safeParse(await c.req.json().catch(() => null))
  if (!input.success) return jsonError(c, 400, 'invalid_body', '构建配置无效')
  const applicationId = c.req.param('appId')
  for (const target of input.data.outputTargets) {
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, target.applicationId))
      .limit(1)
    if (!app || app.status === 'archived')
      throw new JenkinsError(
        'jenkins_invalid_output_target',
        '发布目标应用不存在或已归档',
        400,
      )
    if (!(await hasApplicationRole(c.get('user'), app.id, 'maintainer')))
      throw new JenkinsError('forbidden', '无权配置此发布目标', 403)
    target.name = app.name
  }
  const [current] = await db
    .select()
    .from(applicationBuildConfigs)
    .where(eq(applicationBuildConfigs.applicationId, applicationId))
    .limit(1)
  if ((current?.revision ?? 0) !== input.data.revision)
    throw new JenkinsError(
      'jenkins_config_conflict',
      '配置已被其他人修改，请重新加载后再操作',
      409,
    )
  const checkedJob = input.data.enabled ? await verifyJob(input.data) : null
  const parameters = input.data.parameters.map((parameter) => {
    const definition = checkedJob?.parameters.find((item) => item.name === parameter.name)
    return definition?.type === 'ChoiceParameterDefinition' && definition.choices?.length
      ? { ...parameter, choices: definition.choices }
      : parameter
  })
  const values = {
    ...input.data,
    parameters,
    connectionId: input.data.connectionId ?? 'default',
    applicationId,
    revision: input.data.revision + 1,
    updatedAt: new Date(),
  }
  const [saved] = current
    ? await db
        .update(applicationBuildConfigs)
        .set(values)
        .where(
          and(
            eq(applicationBuildConfigs.applicationId, applicationId),
            eq(applicationBuildConfigs.revision, input.data.revision),
          ),
        )
        .returning()
    : await db
        .insert(applicationBuildConfigs)
        .values(values)
        .onConflictDoNothing()
        .returning()
  if (!saved)
    throw new JenkinsError(
      'jenkins_config_conflict',
      '配置已被其他人修改，请重新加载后再操作',
      409,
    )
  await writeAudit(c, {
    action: 'app.build_config_update',
    objectType: 'application',
    objectId: applicationId,
    applicationId,
    summary: '更新应用构建配置',
    meta: {
      connectionId: saved.connectionId,
      jobPath: saved.jobPath,
      enabled: saved.enabled,
    },
  })
  return c.json({ config: publicBuildConfig(saved) })
})
