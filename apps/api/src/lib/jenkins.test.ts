import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applicationBuildInput,
  decryptJenkinsToken,
  encryptJenkinsToken,
  jenkinsConnectionInput,
  testJenkinsConnection,
  testJenkinsJob,
} from './jenkins.js'

const credentials = {
  baseUrl: 'http://jenkins.internal:8080/jenkins',
  username: 'builder',
  token: 'private-token',
}
const config = {
  enabled: true,
  jobPath: 'team/河南',
  artifactPattern: 'artifacts/*.tar.gz',
  outputTargets: [],
  parameters: [{ name: 'MODE', value: 'test' }],
  revision: 0,
}
const job = {
  _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
  fullName: 'team/河南',
  buildable: true,
  property: [
    {
      parameterDefinitions: [
        { name: 'MODE', type: 'ChoiceParameterDefinition', choices: ['test', 'prod'] },
      ],
    },
  ],
}
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubEnv('JENKINS_ENCRYPTION_KEY', 'ab'.repeat(32))
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Jenkins 连接边界', () => {
  it('Token 使用随机密文保存，密钥错误或内容篡改时失败且不泄漏原文', () => {
    const encrypted = encryptJenkinsToken(credentials.token)
    expect(encrypted).not.toContain(credentials.token)
    expect(encrypted).not.toBe(encryptJenkinsToken(credentials.token))
    expect(decryptJenkinsToken(encrypted)).toBe(credentials.token)
    vi.stubEnv('JENKINS_ENCRYPTION_KEY', 'cd'.repeat(32))
    expect(() => decryptJenkinsToken(encrypted)).toThrow('无法读取 Jenkins 凭据')
    vi.stubEnv('JENKINS_ENCRYPTION_KEY', '')
    expect(() => encryptJenkinsToken(credentials.token)).toThrow('加密密钥')
  })
  it.each([
    'file:///etc/passwd',
    'http://user:secret@host',
    'http://host/?token=secret',
    'http://host/#fragment',
  ])('拒绝非服务地址 %s', (baseUrl) => {
    expect(
      jenkinsConnectionInput.safeParse({
        ...credentials,
        baseUrl,
        enabled: true,
        revision: 0,
      }).success,
    ).toBe(false)
  })
  it.each(['../other', '/job/henan', 'a//b', 'a/%2e%2e', 'a\\b'])(
    '拒绝越界任务路径 %s',
    (jobPath) => {
      expect(applicationBuildInput.safeParse({ ...config, jobPath }).success).toBe(false)
    },
  )
  it('拒绝重复参数名和绝对产物路径', () => {
    expect(
      applicationBuildInput.safeParse({
        ...config,
        parameters: [config.parameters[0], config.parameters[0]],
      }).success,
    ).toBe(false)
    expect(
      applicationBuildInput.safeParse({ ...config, artifactPattern: '/etc/*' }).success,
    ).toBe(false)
  })
  it('保留 context path，按段编码 folder/job，使用只读接口且禁止重定向', async () => {
    fetchMock.mockResolvedValue(Response.json(job))
    await expect(testJenkinsJob(credentials, config)).resolves.toMatchObject({
      fullName: 'team/河南',
    })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.pathname).toBe('/jenkins/job/team/job/%E6%B2%B3%E5%8D%97/api/json')
    expect(options).toMatchObject({ method: 'GET', redirect: 'error' })
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('builder:private-token').toString('base64')}`,
    )
  })
  it('连接检测要求 Jenkins 服务标识，不能把登录页识别为成功', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ mode: 'NORMAL' }, { headers: { 'X-Jenkins': '2.580.1' } }),
    )
    await expect(testJenkinsConnection(credentials)).resolves.toEqual({
      ok: true,
      version: '2.580.1',
    })
    fetchMock.mockResolvedValue(new Response('<html>login</html>'))
    await expect(testJenkinsConnection(credentials)).rejects.toMatchObject({
      code: 'jenkins_connection_failed',
    })
  })
  it('兼容自由风格任务的 Choice 和 Text 参数，仍验证实际选项', async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        ...job,
        _class: 'hudson.model.FreeStyleProject',
        property: [
          {
            parameterDefinitions: [
              {
                name: 'MODE',
                type: 'ChoiceParameterDefinition',
                choices: ['test', 'prod'],
              },
              { name: 'buildApps', type: 'TextParameterDefinition' },
            ],
          },
        ],
      }),
    )
    await expect(
      testJenkinsJob(credentials, {
        ...config,
        parameters: [...config.parameters, { name: 'buildApps', value: 'frieren' }],
      }),
    ).resolves.toMatchObject({ fullName: job.fullName })
    await expect(
      testJenkinsJob(credentials, {
        ...config,
        parameters: [{ name: 'MODE', value: 'bad' }],
      }),
    ).rejects.toMatchObject({ code: 'jenkins_invalid_parameter' })
  })
  it('错误响应中的密钥不进入用户错误', async () => {
    fetchMock.mockResolvedValue(new Response('private-token', { status: 403 }))
    await expect(testJenkinsConnection(credentials)).rejects.toMatchObject({
      code: 'jenkins_access_denied',
    })
  })
  it('拒绝文件夹、停用任务、未定义参数和错误选项值', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ ...job, _class: 'com.cloudbees.hudson.plugins.folder.Folder' }),
    )
    await expect(testJenkinsJob(credentials, config)).rejects.toMatchObject({
      code: 'jenkins_unsupported_job',
    })
    fetchMock.mockResolvedValue(Response.json({ ...job, buildable: false }))
    await expect(testJenkinsJob(credentials, config)).rejects.toMatchObject({
      code: 'jenkins_job_disabled',
    })
    fetchMock.mockImplementation(async () => Response.json(job))
    await expect(
      testJenkinsJob(credentials, {
        ...config,
        parameters: [{ name: 'TOKEN', value: 'secret' }],
      }),
    ).rejects.toMatchObject({ code: 'jenkins_invalid_parameter' })
    await expect(
      testJenkinsJob(credentials, {
        ...config,
        parameters: [{ name: 'MODE', value: 'bad' }],
      }),
    ).rejects.toMatchObject({ code: 'jenkins_invalid_parameter' })
  })
  it('响应大小和请求总耗时都有上限', async () => {
    fetchMock.mockResolvedValue(new Response('x'.repeat(1024 * 1024 + 1)))
    await expect(testJenkinsConnection(credentials)).rejects.toMatchObject({
      code: 'jenkins_connection_failed',
    })
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () => reject(new Error('timeout'))),
        ),
    )
    const pending = expect(testJenkinsConnection(credentials)).rejects.toMatchObject({
      code: 'jenkins_connection_failed',
    })
    await vi.advanceTimersByTimeAsync(10_000)
    await pending
  })
})
