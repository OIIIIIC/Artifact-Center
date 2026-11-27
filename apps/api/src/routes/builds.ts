import { and, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client.js'
import { applicationBuilds, applications, buildPublications } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import {
  buildCredentials,
  enqueueBuild,
  publicBuild,
  requestBuildCancellation,
  startBuildInput,
  type BuildRun,
} from '../lib/build-workflow.js'
import {
  enqueueBuildPublication,
  publicPublication,
  publishBuildInput,
  selectedBuildFile,
} from '../lib/build-publication.js'
import { attachmentDisposition } from '../lib/download-response.js'
import { jsonError } from '../lib/errors.js'
import { JenkinsError } from '../lib/jenkins.js'
import { openJenkinsArtifact, readJenkinsLog } from '../lib/jenkins-build-client.js'
import { signBuildDownloadTicket, verifyBuildDownloadTicket } from '../lib/jwt.js'
import { hasApplicationRole } from '../middleware/application-access.js'
import {
  requireAuth,
  validateCurrentAuthUser,
  type AuthVariables,
} from '../middleware/auth.js'

export const buildRoutes = new Hono<{ Variables: AuthVariables }>()
buildRoutes.onError((error, c) =>
  error instanceof JenkinsError
    ? jsonError(c, error.status, error.code, error.message)
    : jsonError(c, 500, 'internal_error', '构建服务暂不可用'),
)
buildRoutes.use('/applications/:appId/builds/*', requireAuth, async (c, next) => {
  const appId = c.req.param('appId') ?? ''
  if (!z.string().uuid().safeParse(appId).success)
    return jsonError(c, 400, 'invalid_body', '应用 ID 无效')
  if (!(await hasApplicationRole(c.get('user'), appId, 'maintainer')))
    return jsonError(c, 403, 'forbidden', '无权查看构建')
  const [app] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, appId))
    .limit(1)
  if (!app) return jsonError(c, 404, 'not_found', '应用不存在')
  if (
    app.status === 'archived' &&
    c.req.method !== 'GET' &&
    !c.req.path.endsWith('/cancel') &&
    !c.req.path.endsWith('/download-ticket')
  )
    return jsonError(c, 409, 'archived_application', '应用已归档')
  c.header('Cache-Control', 'no-store')
  await next()
})

async function requireBuild(appId: string, id: string): Promise<BuildRun> {
  if (!z.string().uuid().safeParse(id).success)
    throw new JenkinsError('jenkins_build_missing', '构建记录不存在', 404)
  const [run] = await db
    .select()
    .from(applicationBuilds)
    .where(and(eq(applicationBuilds.id, id), eq(applicationBuilds.applicationId, appId)))
    .limit(1)
  if (!run) throw new JenkinsError('jenkins_build_missing', '构建记录不存在', 404)
  return run
}

buildRoutes.get('/applications/:appId/builds', async (c) => {
  const query = z
    .object({ before: z.string().uuid().optional() })
    .safeParse(c.req.query())
  if (!query.success) return jsonError(c, 400, 'invalid_query', '无效游标')
  if (query.data.before) await requireBuild(c.req.param('appId'), query.data.before)
  // 在数据库比较完整时间精度与 ID，避免同一时间的构建被跳过。
  const rows = await db
    .select()
    .from(applicationBuilds)
    .where(
      and(
        eq(applicationBuilds.applicationId, c.req.param('appId')),
        query.data.before
          ? sql`(${applicationBuilds.createdAt}, ${applicationBuilds.id}) < (SELECT created_at, id FROM application_builds WHERE id = ${query.data.before})`
          : undefined,
      ),
    )
    .orderBy(desc(applicationBuilds.createdAt), desc(applicationBuilds.id))
    .limit(21)
  const items = rows.slice(0, 20)
  return c.json({
    items: items.map(publicBuild),
    nextCursor: rows.length > 20 ? items.at(-1)!.id : null,
  })
})
buildRoutes.post('/applications/:appId/builds', async (c) => {
  const input = startBuildInput.safeParse(await c.req.json().catch(() => null))
  if (!input.success) return jsonError(c, 400, 'invalid_body', '构建参数无效')
  const run = await enqueueBuild(c.req.param('appId'), c.get('user'), input.data)
  await writeAudit(c, {
    action: 'app.build_request',
    objectType: 'application',
    objectId: run.id,
    applicationId: run.applicationId,
    summary: `请求构建 ${run.jobPath}`,
    meta: { buildId: run.id },
  })
  return c.json({ build: publicBuild(run) }, 202)
})
buildRoutes.get('/applications/:appId/builds/:id', async (c) => {
  const run = await requireBuild(c.req.param('appId'), c.req.param('id'))
  const publications = await db
    .select()
    .from(buildPublications)
    .where(eq(buildPublications.buildId, run.id))
    .orderBy(desc(buildPublications.createdAt))
  return c.json({
    build: publicBuild(run),
    publications: publications.map(publicPublication),
  })
})
buildRoutes.post('/applications/:appId/builds/:id/cancel', async (c) => {
  const run = await requireBuild(c.req.param('appId'), c.req.param('id'))
  const updated = await requestBuildCancellation(run)
  await writeAudit(c, {
    action: 'app.build_cancel',
    objectType: 'application',
    objectId: run.id,
    applicationId: run.applicationId,
    summary: `请求取消构建 ${run.jobPath}`,
    meta: { buildId: run.id },
  })
  return c.json({ build: publicBuild(updated) }, 202)
})
buildRoutes.get('/applications/:appId/builds/:id/log', async (c) => {
  const start = z.coerce
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .safeParse(c.req.query('start') ?? 0)
  if (!start.success) return jsonError(c, 400, 'invalid_query', '无效日志游标')
  const run = await requireBuild(c.req.param('appId'), c.req.param('id'))
  if (run.buildNumber === null)
    return c.json({ text: '', nextStart: start.data, more: true, truncated: false })
  const logs = await readJenkinsLog(
    await buildCredentials(run),
    run.jobPath,
    run.buildNumber,
    start.data,
  )
  return c.json(logs)
})
buildRoutes.post('/applications/:appId/builds/:id/download-ticket', async (c) => {
  const input = z
    .object({ relativePath: z.string().min(1).max(1000) })
    .strict()
    .safeParse(await c.req.json().catch(() => null))
  if (!input.success) return jsonError(c, 400, 'invalid_body', '产物路径无效')
  const run = await requireBuild(c.req.param('appId'), c.req.param('id'))
  selectedBuildFile(run, input.data.relativePath)
  const ticket = await signBuildDownloadTicket({
    ...c.get('user'),
    buildId: run.id,
    relativePath: input.data.relativePath,
  })
  return c.json({ url: `/build-downloads/${ticket}` })
})
buildRoutes.get('/build-downloads/:ticket', async (c) => {
  let user: Awaited<ReturnType<typeof verifyBuildDownloadTicket>>
  try {
    const ticket = await verifyBuildDownloadTicket(c.req.param('ticket'))
    const current = await validateCurrentAuthUser(ticket)
    if (!current) throw new Error('invalid_ticket')
    user = current
  } catch {
    return jsonError(c, 401, 'unauthorized', '下载链接已过期')
  }
  const [run] = await db
    .select()
    .from(applicationBuilds)
    .where(eq(applicationBuilds.id, user.buildId))
    .limit(1)
  if (!run) return jsonError(c, 404, 'not_found', '构建不存在')
  if (!(await hasApplicationRole(user, run.applicationId, 'maintainer')))
    return jsonError(c, 403, 'forbidden', '无下载权限')
  const file = selectedBuildFile(run, user.relativePath)
  const remote = await openJenkinsArtifact(
    await buildCredentials(run),
    run.jobPath,
    run.buildNumber!,
    file.relativePath,
    c.req.raw.signal,
  )
  c.header('Content-Type', 'application/octet-stream')
  c.header('Content-Disposition', attachmentDisposition(file.fileName))
  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
  if (remote.sizeBytes !== null) c.header('Content-Length', String(remote.sizeBytes))
  void writeAudit(c, {
    action: 'app.build_download',
    objectType: 'application',
    objectId: run.id,
    applicationId: run.applicationId,
    actorId: user.sub,
    actorName: user.name,
    summary: `下载构建 #${run.buildNumber} · ${file.fileName}`,
  })
  return c.body(remote.stream)
})
buildRoutes.post('/applications/:appId/builds/:id/publications', async (c) => {
  const input = publishBuildInput.safeParse(await c.req.json().catch(() => null))
  if (!input.success) return jsonError(c, 400, 'invalid_body', '发布信息无效')
  const run = await requireBuild(c.req.param('appId'), c.req.param('id'))
  const publication = await enqueueBuildPublication(run, c.get('user'), input.data)
  return c.json({ publication: publicPublication(publication) }, 202)
})
