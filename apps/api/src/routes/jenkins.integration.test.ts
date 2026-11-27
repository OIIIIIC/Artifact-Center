import type { PGlite } from '@electric-sql/pglite'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const fixture = vi.hoisted(() => ({ client: null as unknown as PGlite }))
vi.mock('../db/client.js', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm')
  fixture.client = new PGlite({ extensions: { pg_trgm } })
  return { db: drizzle(fixture.client) }
})
import { signAccessToken } from '../lib/jwt.js'
import { buildCredentials } from '../lib/build-workflow.js'
import { applicationBuildRoutes, jenkinsSettingsRoutes } from './jenkins.js'

const app = new Hono()
  .route('/settings/jenkins', jenkinsSettingsRoutes)
  .route('/applications', applicationBuildRoutes)
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  maintainer: '00000000-0000-4000-8000-000000000002',
  viewer: '00000000-0000-4000-8000-000000000003',
  application: '00000000-0000-4000-8000-000000000010',
  other: '00000000-0000-4000-8000-000000000011',
  region: '00000000-0000-4000-8000-000000000020',
}
const tokens: Record<string, string> = {}
const config = {
  enabled: true,
  jobPath: 'henan',
  artifactPattern: 'artifacts/*.tar.gz',
  parameters: [{ name: 'buildMode', value: 'test' }],
  revision: 0,
}
const connection = {
  baseUrl: 'http://jenkins.internal:8080',
  username: 'builder',
  token: 'jenkins-test-private-token',
  enabled: true,
  revision: 0,
}
const fetchMock = vi.fn()
const request = (path: string, method = 'GET', body?: unknown, role = 'admin') =>
  app.request(path, {
    method,
    headers: {
      Authorization: `Bearer ${tokens[role] ?? ''}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
const buildUrl = `/applications/${ids.application}/build-config`

beforeAll(async () => {
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as { entries: { tag: string }[] }
  for (const entry of journal.entries)
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  for (const role of ['admin', 'maintainer', 'viewer'] as const) {
    // 平台 viewer 可被授予单应用维护权限，不能仅依赖平台角色。
    const platformRole = role === 'admin' ? 'admin' : 'viewer'
    await fixture.client.query(
      'INSERT INTO users (id,username,email,name,password_hash,role) VALUES ($1,$2,$3,$2,$4,$5)',
      [ids[role], role, `${role}@test.local`, 'unused', platformRole],
    )
    tokens[role] = await signAccessToken({
      sub: ids[role],
      role: platformRole,
      name: role,
      email: `${role}@test.local`,
      tokenVersion: 0,
    })
  }
  await fixture.client.query('INSERT INTO regions (id,code,name) VALUES ($1,$2,$3)', [
    ids.region,
    'jenkins-test',
    'Jenkins test',
  ])
  for (const id of [ids.application, ids.other])
    await fixture.client.query(
      "INSERT INTO applications (id,name,application_code,package_name,platform,region_id) VALUES ($1,'Test app','test','test','linux',$2)",
      [id, ids.region],
    )
  await fixture.client.query(
    "INSERT INTO application_members (application_id,user_id,role) VALUES ($1,$2,'maintainer')",
    [ids.application, ids.maintainer],
  )
}, 30_000)
beforeEach(async () => {
  await fixture.client.exec(
    'DELETE FROM application_build_configs; DELETE FROM jenkins_connections; DELETE FROM audit_logs;',
  )
  await fixture.client.query("UPDATE applications SET status='active' WHERE id=$1", [
    ids.application,
  ])
  vi.stubEnv('JENKINS_ENCRYPTION_KEY', 'ab'.repeat(32))
  fetchMock.mockReset().mockImplementation(async (url: URL) =>
    url.pathname.includes('/job/')
      ? Response.json({
          _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
          fullName: 'henan',
          buildable: true,
          property: [
            {
              parameterDefinitions: [
                {
                  name: 'buildMode',
                  type: 'ChoiceParameterDefinition',
                  choices: ['test', 'prod'],
                },
              ],
            },
          ],
        })
      : Response.json({ mode: 'NORMAL' }, { headers: { 'X-Jenkins': '2.580.1' } }),
  )
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
afterAll(async () => fixture.client.close())

describe('Jenkins 配置：真实鉴权、迁移和持久化', () => {
  it('全量迁移后旧应用无构建配置；未登录、非管理员不能配置连接', async () => {
    expect(
      (await request('/settings/jenkins', 'GET', undefined, 'anonymous')).status,
    ).toBe(401)
    for (const role of ['maintainer', 'viewer']) {
      for (const method of ['GET', 'PUT'])
        expect(
          (
            await request(
              '/settings/jenkins',
              method,
              method === 'PUT' ? connection : undefined,
              role,
            )
          ).status,
        ).toBe(403)
      expect(
        (await request('/settings/jenkins/test', 'POST', connection, role)).status,
      ).toBe(403)
    }
    expect(await (await request(buildUrl)).json()).toMatchObject({
      config: null,
      connectionReady: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('连接检测不保存；保存后 Token 加密且响应、审计永不回显', async () => {
    expect((await request('/settings/jenkins/test', 'POST', connection)).status).toBe(200)
    expect(
      (await fixture.client.query('SELECT * FROM jenkins_connections')).rows,
    ).toHaveLength(0)
    const saved = await request('/settings/jenkins', 'PUT', connection)
    expect(saved.status).toBe(200)
    expect(await saved.text()).not.toContain(connection.token)
    const stored = (
      await fixture.client.query<{ token_ciphertext: string }>(
        'SELECT token_ciphertext FROM jenkins_connections',
      )
    ).rows[0]
    expect(stored.token_ciphertext).toMatch(/^v1\./)
    expect(stored.token_ciphertext).not.toContain(connection.token)
    const response = await request('/settings/jenkins')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).not.toContain(stored.token_ciphertext)
    expect(
      JSON.stringify((await fixture.client.query('SELECT * FROM audit_logs')).rows),
    ).not.toContain(connection.token)
  })
  it('多连接分别保存凭据和应用绑定；停用默认连接不影响另一连接或历史记录', async () => {
    await request('/settings/jenkins', 'PUT', connection)
    const second = {
      ...connection,
      name: '河南 14',
      baseUrl: 'http://jenkins-14:9999',
      username: 'henan-builder',
      token: 'separate-14-token',
    }
    expect(
      (await request('/settings/jenkins/connections/henan-14', 'PUT', second)).status,
    ).toBe(200)
    expect(
      (await request(buildUrl, 'PUT', { ...config, connectionId: 'henan-14' })).status,
    ).toBe(200)
    const settings = (await (
      await request(buildUrl, 'GET', undefined, 'maintainer')
    ).json()) as { config: { connectionId: string }; connections: unknown[] }
    expect(settings.config.connectionId).toBe('henan-14')
    expect(settings.connections).toHaveLength(2)
    expect(JSON.stringify(settings.connections)).not.toContain('username')
    expect(JSON.stringify(settings)).not.toContain(second.token)
    expect(
      (
        await request('/settings/jenkins', 'PUT', {
          ...connection,
          enabled: false,
          revision: 1,
        })
      ).status,
    ).toBe(200)
    expect(
      await buildCredentials({
        connectionId: 'henan-14',
        baseUrl: second.baseUrl,
        username: second.username,
      }),
    ).toMatchObject({ token: second.token })
    await expect(
      buildCredentials({
        connectionId: 'default',
        baseUrl: connection.baseUrl,
        username: connection.username,
      }),
    ).rejects.toMatchObject({ code: 'jenkins_connection_changed' })
    await expect(
      buildCredentials({
        connectionId: 'henan-14',
        baseUrl: connection.baseUrl,
        username: connection.username,
      }),
    ).rejects.toMatchObject({ code: 'jenkins_connection_changed' })
    const all = (await (await request('/settings/jenkins')).json()) as {
      connections: unknown[]
      connection: { baseUrl: string }
    }
    expect(all.connections).toHaveLength(2)
    expect(all.connection.baseUrl).toBe(connection.baseUrl)
    expect(JSON.stringify(all)).not.toContain('tokenCiphertext')
  })
  it('新连接不能借用默认 Token；命名连接的写入和检测仅管理员可执行', async () => {
    await request('/settings/jenkins', 'PUT', connection)
    const { token: _token, ...input } = connection
    expect(
      (await request('/settings/jenkins/connections/second', 'PUT', input)).status,
    ).toBe(400)
    expect(
      (await request('/settings/jenkins/connections/second/test', 'POST', input)).status,
    ).toBe(400)
    for (const role of ['maintainer', 'viewer']) {
      expect(
        (await request('/settings/jenkins/connections/second', 'PUT', connection, role))
          .status,
      ).toBe(403)
      expect(
        (
          await request(
            '/settings/jenkins/connections/second/test',
            'POST',
            connection,
            role,
          )
        ).status,
      ).toBe(403)
    }
    expect(
      (await request('/settings/jenkins/connections/invalid%20id', 'PUT', connection))
        .status,
    ).toBe(400)
  })
  it('Token 留空保留；地址变化要求新 Token；旧版本写入返回冲突', async () => {
    await request('/settings/jenkins', 'PUT', connection)
    const { token: _token, ...kept } = { ...connection, revision: 1 }
    expect(
      (
        await request('/settings/jenkins', 'PUT', {
          ...kept,
          baseUrl: 'http://other-host',
        })
      ).status,
    ).toBe(400)
    expect((await request('/settings/jenkins', 'PUT', kept)).status).toBe(200)
    expect((await request('/settings/jenkins', 'PUT', kept)).status).toBe(409)
    expect(fetchMock.mock.calls.every(([, options]) => options.method === 'GET')).toBe(
      true,
    )
  })
  it('错误凭据与缺失加密密钥不能启用连接，停用时不需要访问 Jenkins', async () => {
    fetchMock.mockResolvedValue(new Response('secret-response', { status: 403 }))
    const rejected = await request('/settings/jenkins', 'PUT', connection)
    expect(rejected.status).toBe(502)
    expect(await rejected.text()).not.toContain('secret-response')
    expect(
      (await fixture.client.query('SELECT * FROM jenkins_connections')).rows,
    ).toHaveLength(0)
    expect(
      (await request('/settings/jenkins', 'PUT', { ...connection, enabled: false }))
        .status,
    ).toBe(200)
    vi.stubEnv('JENKINS_ENCRYPTION_KEY', '')
    expect(
      (await request('/settings/jenkins', 'PUT', { ...connection, revision: 1 })).status,
    ).toBe(503)
  })
  it('构建配置仅管理员可写；应用维护者可读，非成员不能跨应用读取', async () => {
    await request('/settings/jenkins', 'PUT', connection)
    expect((await request(buildUrl, 'PUT', config, 'maintainer')).status).toBe(403)
    expect((await request(`${buildUrl}/test`, 'POST', config, 'maintainer')).status).toBe(
      403,
    )
    expect((await request(buildUrl, 'PUT', config)).status).toBe(200)
    const maintained = await request(buildUrl, 'GET', undefined, 'maintainer')
    expect(maintained.status).toBe(200)
    expect(await maintained.json()).toMatchObject({
      config: {
        jobPath: 'henan',
        revision: 1,
        parameters: [{ name: 'buildMode', value: 'test' }],
        parameterChoices: [{ name: 'buildMode', choices: ['test', 'prod'] }],
      },
      connectionReady: true,
    })
    expect((await request(buildUrl, 'GET', undefined, 'viewer')).status).toBe(403)
    expect(
      (
        await request(
          `/applications/${ids.other}/build-config`,
          'GET',
          undefined,
          'maintainer',
        )
      ).status,
    ).toBe(403)
    expect((await request(buildUrl, 'PUT', config)).status).toBe(409)
  })
  it('未连接、非法参数、归档应用不能启用构建；禁用草稿可离线保存', async () => {
    expect((await request(buildUrl, 'PUT', config)).status).toBe(409)
    await request('/settings/jenkins', 'PUT', connection)
    expect(
      (
        await request(buildUrl, 'PUT', {
          ...config,
          parameters: [{ name: 'buildMode', value: 'unknown' }],
        })
      ).status,
    ).toBe(400)
    expect(
      (await fixture.client.query('SELECT * FROM application_build_configs')).rows,
    ).toHaveLength(0)
    expect((await request(buildUrl, 'PUT', { ...config, enabled: false })).status).toBe(
      200,
    )
    await fixture.client.query("UPDATE applications SET status='archived' WHERE id=$1", [
      ids.application,
    ])
    expect((await request(buildUrl, 'PUT', { ...config, revision: 1 })).status).toBe(409)
    expect((await request(`${buildUrl}/test`, 'POST', config)).status).toBe(409)
    expect((await request(buildUrl)).status).toBe(200)
  })
  it('任务校验不写入配置，删除应用由外键清理绑定', async () => {
    await request('/settings/jenkins', 'PUT', connection)
    expect((await request(`${buildUrl}/test`, 'POST', config)).status).toBe(200)
    expect(
      (await fixture.client.query('SELECT * FROM application_build_configs')).rows,
    ).toHaveLength(0)
    await request(`/applications/${ids.other}/build-config`, 'PUT', config)
    await fixture.client.query('DELETE FROM applications WHERE id=$1', [ids.other])
    expect(
      (await fixture.client.query('SELECT * FROM application_build_configs')).rows,
    ).toHaveLength(0)
  })
})
