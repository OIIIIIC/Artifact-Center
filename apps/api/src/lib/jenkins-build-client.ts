import { z } from 'zod'
import {
  JenkinsError,
  normalizeJenkinsUrl,
  readJenkins,
  relativePath,
  type JenkinsCredentials,
} from './jenkins.js'

export const MAX_BUILD_ARTIFACT_BYTES = 512 * 1024 * 1024
export const jobPrefix = (jobPath: string) =>
  jobPath
    .split('/')
    .map((part) => `job/${encodeURIComponent(part)}/`)
    .join('')
export const BUILD_REQUEST_PARAMETER = 'ARTIFACT_CENTER_REQUEST_ID'

/** 仅使用服务端构造的相对路径；不跟随 Jenkins 返回的 URL 或重定向。 */
async function openResponse(
  credentials: JenkinsCredentials,
  path: string,
  init: RequestInit = {},
  timeout = 15_000,
) {
  const controller = new AbortController()
  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal
  const timer = setTimeout(() => controller.abort(), timeout)
  const close = () => {
    clearTimeout(timer)
    controller.abort()
  }
  try {
    const response = await fetch(`${normalizeJenkinsUrl(credentials.baseUrl)}/${path}`, {
      ...init,
      redirect: 'manual',
      signal,
      headers: {
        ...init.headers,
        Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64')}`,
      },
    })
    return { response, close }
  } catch {
    close()
    throw new JenkinsError(
      'jenkins_connection_failed',
      'Jenkins 请求未得到确认，请稍后刷新状态',
      502,
    )
  }
}

export async function triggerJenkinsBuild(
  credentials: JenkinsCredentials,
  jobPath: string,
  parameters: Array<{ name: string; value: string }>,
  parameterized: boolean,
  id: string,
  trackRequest: boolean,
) {
  const body = new URLSearchParams(
    parameters.map(({ name, value }): [string, string] => [name, value]),
  )
  if (trackRequest) body.set(BUILD_REQUEST_PARAMETER, id)
  const { response, close } = await openResponse(
    credentials,
    `${jobPrefix(jobPath)}${parameterized ? 'buildWithParameters' : 'build'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  )
  try {
    if ([400, 401, 403, 404, 405].includes(response.status))
      throw new JenkinsError(
        'jenkins_build_rejected',
        'Jenkins 拒绝构建，请检查任务、参数及 Job/Build 权限',
        400,
      )
    // 只接受明确的创建结果。其他响应可能是代理错误，不重试 POST。
    if (response.status !== 201)
      throw new JenkinsError(
        'jenkins_submission_unknown',
        '构建提交结果尚未确认，正在核对 Jenkins 队列',
        502,
      )
    const location = response.headers.get('location') ?? ''
    const match = new URL(location, credentials.baseUrl).pathname.match(
      /\/queue\/item\/(\d+)\/?$/,
    )
    const queueId = match ? Number(match[1]) : NaN
    if (!Number.isSafeInteger(queueId) || queueId <= 0)
      throw new JenkinsError(
        'jenkins_submission_unknown',
        '未收到有效队列编号，正在核对 Jenkins 队列',
        502,
      )
    return queueId
  } finally {
    await response.body?.cancel()
    close()
  }
}

const number = z.number().int().positive().safe()
const queueSchema = z.object({
  id: number,
  cancelled: z.boolean().optional(),
  why: z.string().nullable().optional(),
  executable: z.object({ number }).nullable().optional(),
})
export async function readJenkinsQueue(credentials: JenkinsCredentials, queueId: number) {
  const { data } = await readJenkins(
    credentials,
    `queue/item/${queueId}/`,
    'id,cancelled,why,executable[number]',
  )
  const queue = queueSchema.parse(data)
  if (queue.id !== queueId)
    throw new JenkinsError('jenkins_identity_mismatch', 'Jenkins 队列编号不一致', 502)
  return queue
}

export type BuildFile = { fileName: string; relativePath: string }
const fileSchema = z.object({
  fileName: z.string().min(1).max(500),
  relativePath: z.string().min(1).max(1000).refine(relativePath),
})
const buildSchema = z.object({
  number,
  queueId: z.number().int().safe(),
  building: z.boolean(),
  result: z.string().nullable(),
  timestamp: z.number().nonnegative(),
  duration: z.number().nonnegative(),
  artifacts: z.array(fileSchema).max(1000),
  actions: z
    .array(
      z.object({
        lastBuiltRevision: z.object({ SHA1: z.string() }).optional(),
        revision: z
          .object({ SHA1: z.string().optional(), hash: z.string().optional() })
          .optional(),
      }),
    )
    .optional(),
})

/** 动态规划逐段匹配 * 和 **，避免连续通配符造成正则回溯。 */
export function matchesArtifactPattern(path: string, pattern: string): boolean {
  if (!relativePath(path) || !relativePath(pattern)) return false
  const match = (
    values: string[],
    rules: string[],
    wildcard: string,
    equal: (a: string, b: string) => boolean,
  ) => {
    let row = Array<boolean>(values.length + 1).fill(false)
    row[0] = true
    for (const rule of rules) {
      const next = Array<boolean>(values.length + 1).fill(false)
      next[0] = rule === wildcard && row[0]
      for (let i = 1; i <= values.length; i++)
        next[i] =
          rule === wildcard
            ? row[i] || next[i - 1]
            : row[i - 1] && equal(values[i - 1], rule)
      row = next
    }
    return row[values.length]
  }
  return match(path.split('/'), pattern.split('/'), '**', (value, rule) =>
    match([...value], [...rule], '*', (a, b) => a === b),
  )
}

export async function readJenkinsBuild(
  credentials: JenkinsCredentials,
  jobPath: string,
  buildNumber: number,
  queueId: number | null,
  pattern: string,
) {
  const { data } = await readJenkins(
    credentials,
    `${jobPrefix(jobPath)}${buildNumber}/`,
    'number,queueId,building,result,timestamp,duration,artifacts[fileName,relativePath],actions[lastBuiltRevision[SHA1],revision[SHA1,hash]]',
  )
  const result = buildSchema.safeParse(data)
  if (!result.success)
    throw new JenkinsError('jenkins_invalid_response', '构建信息格式无效', 502)
  const build = result.data
  if (build.number !== buildNumber || (queueId !== null && build.queueId !== queueId))
    throw new JenkinsError(
      'jenkins_identity_mismatch',
      '构建编号与请求不一致，已阻止读取产物',
      502,
    )
  const commits = [
    ...new Set(
      (build.actions ?? [])
        .flatMap((action) => [
          action.lastBuiltRevision?.SHA1,
          action.revision?.SHA1,
          action.revision?.hash,
        ])
        .filter((value): value is string =>
          Boolean(value && /^[a-f0-9]{7,64}$/i.test(value)),
        ),
    ),
  ]
  return {
    ...build,
    commits,
    artifacts: build.artifacts
      .filter((file) => matchesArtifactPattern(file.relativePath, pattern))
      .map((file) => ({ ...file, fileName: file.relativePath.split('/').at(-1)! })),
  }
}

const actions = z
  .array(
    z.object({
      parameters: z
        .array(z.object({ name: z.string(), value: z.unknown().optional() }))
        .optional(),
    }),
  )
  .optional()
export async function findJenkinsSubmission(
  credentials: JenkinsCredentials,
  jobPath: string,
  id: string,
  queueId: number | null,
) {
  const hasRequest = (items: z.infer<typeof actions>) =>
    items?.some((action) =>
      action.parameters?.some(
        (parameter) =>
          parameter.name === BUILD_REQUEST_PARAMETER && parameter.value === id,
      ),
    )
  if (queueId === null) {
    const { data } = await readJenkins(
      credentials,
      'queue/',
      'items[id,task[fullName],actions[parameters[name,value]]]',
    )
    const queue = z
      .object({
        items: z.array(
          z.object({ id: number, task: z.object({ fullName: z.string() }), actions }),
        ),
      })
      .parse(data)
    const found = queue.items.find(
      (item) => item.task.fullName === jobPath && hasRequest(item.actions),
    )
    if (found) return { queueId: found.id, buildNumber: null }
  }
  const { data } = await readJenkins(
    credentials,
    jobPrefix(jobPath),
    'builds[number,queueId,actions[parameters[name,value]]]{0,100}',
  )
  const builds = z
    .object({
      builds: z.array(z.object({ number, queueId: z.number().int().safe(), actions })),
    })
    .parse(data)
  const found = builds.builds.find((build) =>
    queueId !== null ? build.queueId === queueId : hasRequest(build.actions),
  )
  return found ? { queueId: found.queueId, buildNumber: found.number } : null
}

export async function cancelJenkinsBuild(
  credentials: JenkinsCredentials,
  jobPath: string,
  buildNumber: number | null,
  queueId: number | null,
) {
  const path =
    buildNumber !== null
      ? `${jobPrefix(jobPath)}${buildNumber}/stop`
      : `queue/cancelItem?id=${queueId}`
  const { response, close } = await openResponse(credentials, path, { method: 'POST' })
  try {
    if (![200, 201, 302, 303].includes(response.status))
      throw new JenkinsError(
        'jenkins_cancel_failed',
        'Jenkins 未确认取消，请刷新状态后重试',
        502,
      )
  } finally {
    await response.body?.cancel()
    close()
  }
}

export async function readJenkinsLog(
  credentials: JenkinsCredentials,
  jobPath: string,
  buildNumber: number,
  start: number,
) {
  const { response, close } = await openResponse(
    credentials,
    `${jobPrefix(jobPath)}${buildNumber}/logText/progressiveText?start=${start}`,
  )
  try {
    if (!response.ok || !response.body)
      throw new JenkinsError(
        'jenkins_log_unavailable',
        '日志暂不可用或已被 Jenkins 清理',
        502,
      )
    const nextStart = Number(response.headers.get('x-text-size'))
    if (
      !Number.isSafeInteger(nextStart) ||
      nextStart < start ||
      !response.headers.has('x-text-size')
    )
      throw new JenkinsError('jenkins_invalid_response', '日志游标无效', 502)
    const reader = response.body.getReader()
    let tail = Buffer.alloc(0),
      readBytes = 0,
      truncated = false
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        readBytes += value.byteLength
        tail = Buffer.concat([tail, value])
        if (tail.length > 128 * 1024) {
          tail = tail.subarray(-128 * 1024)
          truncated = true
        }
        if (readBytes > 8 * 1024 * 1024) {
          truncated = true
          break
        }
      }
    } finally {
      await reader.cancel()
    }
    return {
      text: tail.toString('utf8'),
      nextStart,
      more: response.headers.get('x-more-data') === 'true',
      truncated,
    }
  } finally {
    close()
  }
}

export async function openJenkinsArtifact(
  credentials: JenkinsCredentials,
  jobPath: string,
  buildNumber: number,
  path: string,
  signal?: AbortSignal,
) {
  if (!relativePath(path)) throw new JenkinsError('jenkins_invalid_path', '产物路径无效')
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const { response, close } = await openResponse(
    credentials,
    `${jobPrefix(jobPath)}${buildNumber}/artifact/${encoded}`,
    { signal },
    5 * 60_000,
  )
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    close()
    throw new JenkinsError(
      'jenkins_artifact_unavailable',
      '构建产物不可用，可能已被 Jenkins 清理',
      502,
    )
  }
  const length = response.headers.get('content-length')
  const sizeBytes = length === null ? null : Number(length)
  if (
    sizeBytes !== null &&
    (!Number.isSafeInteger(sizeBytes) ||
      sizeBytes <= 0 ||
      sizeBytes > MAX_BUILD_ARTIFACT_BYTES)
  ) {
    await response.body.cancel()
    close()
    throw new JenkinsError('jenkins_artifact_size', '产物为空或超过 512 MiB 限制', 400)
  }
  let received = 0
  const reader = response.body.getReader()
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (done) {
          if (sizeBytes !== null && received !== sizeBytes)
            throw new Error('size_mismatch')
          controller.close()
          close()
          return
        }
        received += value.byteLength
        if (received > MAX_BUILD_ARTIFACT_BYTES) throw new Error('size_limit')
        controller.enqueue(value)
      } catch {
        controller.error(new Error('Jenkins 产物传输中断'))
        await reader.cancel().catch(() => undefined)
        close()
      }
    },
    async cancel() {
      await reader.cancel().catch(() => undefined)
      close()
    },
  })
  return {
    stream,
    sizeBytes,
    close: async () => {
      close()
      await reader.cancel().catch(() => undefined)
    },
  }
}
