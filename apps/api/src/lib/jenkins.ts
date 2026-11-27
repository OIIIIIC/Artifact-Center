import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { z } from 'zod'

export class JenkinsError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

export function normalizeJenkinsUrl(value: string): string {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('invalid_url')
  }
  // 允许企业内网地址；连接地址仅由平台管理员配置。
  return url.href.replace(/\/+$/, '')
}

const baseUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .transform((value, ctx) => {
    try {
      return normalizeJenkinsUrl(value)
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请输入不含账号、查询参数的 HTTP(S) 地址',
      })
      return z.NEVER
    }
  })

export const jenkinsConnectionInput = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    baseUrl,
    username: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((value) => !value.includes(':') && !hasControlCharacters(value)),
    token: z
      .string()
      .trim()
      .min(1)
      .max(1024)
      .regex(/^[^\s]+$/)
      .optional(),
    enabled: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict()

const hasControlCharacters = (value: string) =>
  Array.from(value).some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  )

export const relativePath = (value: string) =>
  !hasControlCharacters(value) &&
  !/[\\%?#]/.test(value) &&
  value.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..')

export const applicationBuildInput = z
  .object({
    connectionId: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/)
      .optional(),
    enabled: z.boolean(),
    jobPath: z.string().trim().min(1).max(300).refine(relativePath),
    artifactPattern: z.string().trim().min(1).max(300).refine(relativePath),
    outputTargets: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            pattern: z.string().trim().min(1).max(300).refine(relativePath),
            applicationId: z.string().uuid(),
          })
          .strict(),
      )
      .max(20)
      .default([])
      .refine(
        (items) => new Set(items.map((item) => item.pattern)).size === items.length,
      ),
    parameters: z
      .array(
        z
          .object({
            name: z
              .string()
              .trim()
              .min(1)
              .max(100)
              .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
              .refine(
                (value) =>
                  ![
                    'ARTIFACT_CENTER_REQUEST_ID',
                    'token',
                    'cause',
                    'delay',
                    'json',
                  ].includes(value),
              ),
            value: z.string().max(4000),
          })
          .strict(),
      )
      .max(30)
      .refine((items) => new Set(items.map((item) => item.name)).size === items.length),
    revision: z.number().int().nonnegative(),
  })
  .strict()

export function jenkinsKeyReady() {
  return /^[a-fA-F0-9]{64}$/.test(process.env.JENKINS_ENCRYPTION_KEY ?? '')
}

function encryptionKey() {
  if (!jenkinsKeyReady())
    throw new JenkinsError(
      'jenkins_key_missing',
      '服务器尚未配置 Jenkins 凭据加密密钥',
      503,
    )
  return Buffer.from(process.env.JENKINS_ENCRYPTION_KEY!, 'hex')
}

export function encryptJenkinsToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join('.')
}

export function decryptJenkinsToken(value: string) {
  const key = encryptionKey()
  try {
    const [version, iv, tag, ciphertext, extra] = value.split('.')
    if (version !== 'v1' || !iv || !tag || !ciphertext || extra)
      throw new Error('invalid_ciphertext')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new JenkinsError(
      'jenkins_token_unreadable',
      '无法读取 Jenkins 凭据，请检查加密密钥或重新填写 Token',
      503,
    )
  }
}

export type JenkinsCredentials = { baseUrl: string; username: string; token: string }

export async function readJenkins(
  credentials: JenkinsCredentials,
  path: string,
  tree: string,
) {
  const url = new URL(`${normalizeJenkinsUrl(credentials.baseUrl)}/${path}api/json`)
  url.searchParams.set('tree', tree)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64')}`,
      },
    })
    if (!response.ok) {
      await response.body?.cancel()
      if ([401, 403].includes(response.status))
        throw new JenkinsError(
          'jenkins_access_denied',
          'Jenkins 拒绝访问，请检查账号、Token 和任务读取权限',
          502,
        )
      if (response.status === 404)
        throw new JenkinsError(
          'jenkins_not_found',
          'Jenkins 地址或任务不存在，或当前账号无权查看',
          502,
        )
      throw new JenkinsError('jenkins_unavailable', 'Jenkins 暂时不可用', 502)
    }
    // 不回传 Jenkins 原始响应；限制读取量与总耗时，避免代理错误页或过大响应。
    const reader = response.body?.getReader()
    if (!reader) throw new Error('empty_response')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 1024 * 1024) throw new Error('response_too_large')
        chunks.push(value)
      }
    } finally {
      await reader.cancel()
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return { data, version: response.headers.get('x-jenkins') }
  } catch (error) {
    if (error instanceof JenkinsError) throw error
    throw new JenkinsError(
      'jenkins_connection_failed',
      '无法读取 Jenkins，请检查地址、网络、响应格式和访问权限',
      502,
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function testJenkinsConnection(credentials: JenkinsCredentials) {
  const { data, version } = await readJenkins(credentials, '', 'mode,nodeDescription')
  if (!version || !data || typeof data !== 'object' || !('mode' in data)) {
    throw new JenkinsError(
      'jenkins_invalid_response',
      '此地址未返回有效的 Jenkins 服务信息',
      502,
    )
  }
  return { ok: true as const, version }
}

const jobSchema = z.object({
  _class: z.enum([
    'org.jenkinsci.plugins.workflow.job.WorkflowJob',
    'hudson.model.FreeStyleProject',
  ]),
  fullName: z.string(),
  buildable: z.boolean(),
  property: z
    .array(
      z.object({
        parameterDefinitions: z
          .array(
            z.object({
              name: z.string(),
              type: z.string(),
              choices: z.array(z.string()).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export async function testJenkinsJob(
  credentials: JenkinsCredentials,
  config: z.infer<typeof applicationBuildInput>,
) {
  const path = config.jobPath
    .split('/')
    .map((part) => `job/${encodeURIComponent(part)}/`)
    .join('')
  const { data } = await readJenkins(
    credentials,
    path,
    '_class,fullName,buildable,property[parameterDefinitions[name,type,choices]]',
  )
  const parsed = jobSchema.safeParse(data)
  if (!parsed.success)
    throw new JenkinsError(
      'jenkins_unsupported_job',
      '请选择一个具体的 Pipeline 或自由风格任务；文件夹或多分支父任务不能直接绑定',
      400,
    )
  const job = parsed.data
  if (!job.buildable)
    throw new JenkinsError('jenkins_job_disabled', '该 Jenkins 任务当前不可构建', 400)
  const definitions =
    job.property?.flatMap((item) => item.parameterDefinitions ?? []) ?? []
  for (const parameter of config.parameters) {
    const definition = definitions.find((item) => item.name === parameter.name)
    if (
      !definition ||
      ![
        'StringParameterDefinition',
        'TextParameterDefinition',
        'ChoiceParameterDefinition',
        'BooleanParameterDefinition',
      ].includes(definition.type)
    ) {
      throw new JenkinsError(
        'jenkins_invalid_parameter',
        `任务不支持普通参数：${parameter.name}`,
        400,
      )
    }
    if (
      (definition.choices && !definition.choices.includes(parameter.value)) ||
      (definition.type === 'BooleanParameterDefinition' &&
        !['true', 'false'].includes(parameter.value))
    ) {
      throw new JenkinsError(
        'jenkins_invalid_parameter',
        `参数值无效：${parameter.name}`,
        400,
      )
    }
  }
  return {
    ok: true as const,
    fullName: job.fullName,
    parameters: definitions.map(({ name, type, choices }) => ({
      name,
      type,
      ...(choices ? { choices } : {}),
    })),
  }
}
