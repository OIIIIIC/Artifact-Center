import type { PGlite } from '@electric-sql/pglite'
import { Hono } from 'hono'
import { createServer, type Server, type RequestListener } from 'node:http'
import { readFile, rm } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ client: null as unknown as PGlite, storagePath: '' }))
vi.mock('../db/client.js', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm')
  fixture.client = new PGlite({ extensions: { pg_trgm } })
  return { db: drizzle(fixture.client) }
})
vi.mock('../env.js', async (original) => {
  const actual = await original<typeof import('../env.js')>()
  const { mkdtemp } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  fixture.storagePath = await mkdtemp(join(tmpdir(), 'artifact-jenkins-test-'))
  return {
    env: { ...actual.env, storagePath: fixture.storagePath, storageMinFreeBytes: 1 },
  }
})
import { signAccessToken } from '../lib/jwt.js'
import { processBuildQueue, type publicBuild } from '../lib/build-workflow.js'
import {
  processBuildPublications,
  type publicPublication,
} from '../lib/build-publication.js'
import { buildRoutes } from './builds.js'
import { applicationBuildRoutes, jenkinsSettingsRoutes } from './jenkins.js'

const app = new Hono()
  .route('/settings/jenkins', jenkinsSettingsRoutes)
  .route('/applications', applicationBuildRoutes)
  .route('/', buildRoutes)
const ids = {
  admin: randomUUID(),
  maintainer: randomUUID(),
  viewer: randomUUID(),
  outsider: randomUUID(),
  application: randomUUID(),
  other: randomUUID(),
  region: randomUUID(),
}
const tokens: Record<string, string> = {}
const bytes = gzipSync(
  Buffer.from('Jenkins build output — streamed without browser upload'),
)
const commit = '8376f8b178cd8915300da060373f53406a0971a2'
const state = {
  count: 0,
  running: false,
  finished: false,
  cancelled: false,
  loseResponse: false,
  queueMissing: false,
  artifactMissing: false,
  buildDenied: false,
  artifactBroken: false,
  requestId: '',
  stopCount: 0,
  dual: false,
}
let server: Server
let baseUrl = ''
const buildUrl = `/applications/${ids.application}/builds`
type TestBody = {
  build: ReturnType<typeof publicBuild>
  publications: ReturnType<typeof publicPublication>[]
  publication: ReturnType<typeof publicPublication>
  items: ReturnType<typeof publicBuild>[]
  nextCursor: string | null
  url: string
  text: string
  nextStart: number
}
const request = async (url: string, method = 'GET', body?: unknown, role = 'admin') =>
  (await app.request(url, {
    method,
    headers: {
      Authorization: `Bearer ${tokens[role] ?? role}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })) as Omit<Response, 'json'> & { json(): Promise<TestBody> }
const query = (text: string, values?: unknown[]) => fixture.client.query(text, values)
async function due() {
  await fixture.client.exec(
    "UPDATE application_builds SET next_sync_at='2000-01-01',lease_until=NULL;",
  )
  await processBuildQueue()
}
async function enqueue(key = randomUUID(), role = 'maintainer') {
  const response = await request(
    buildUrl,
    'POST',
    {
      requestKey: key,
      configRevision: 1,
      parameters: [{ name: 'buildMode', value: 'test' }],
    },
    role,
  )
  expect(response.status).toBe(202)
  return (await response.json()).build as { id: string; status: string }
}
async function completed() {
  const build = await enqueue()
  await due()
  state.running = true
  state.finished = true
  await due()
  expect((await (await request(`${buildUrl}/${build.id}`)).json()).build.status).toBe(
    'success',
  )
  return build
}
const publishInput = {
  relativePath: 'artifacts/app.tar.gz',
  version: '1.2.3',
  channel: 'beta',
  releaseNotes: 'Automated build output',
  confirmStable: false,
}

beforeAll(async () => {
  vi.stubEnv('JENKINS_ENCRYPTION_KEY', 'ab'.repeat(32))
  server = createServer(async (req, res) => {
    if (
      req.headers.authorization !==
      `Basic ${Buffer.from('builder:test-token').toString('base64')}`
    ) {
      res.writeHead(403).end()
      return
    }
    const url = new URL(req.url!, 'http://localhost')
    const json = (data: unknown, status = 200) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'X-Jenkins': '2.580.1',
      })
      res.end(JSON.stringify(data))
    }
    if (url.pathname === '/api/json') {
      json({ mode: 'NORMAL' })
      return
    }
    if (url.pathname === '/job/henan/api/json') {
      if (url.searchParams.get('tree')?.startsWith('builds'))
        json({
          builds: state.count
            ? [
                {
                  number: 41,
                  queueId: 101,
                  actions: [
                    {
                      parameters: [
                        { name: 'ARTIFACT_CENTER_REQUEST_ID', value: state.requestId },
                      ],
                    },
                  ],
                },
              ]
            : [],
        })
      else
        json({
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
                { name: 'ARTIFACT_CENTER_REQUEST_ID', type: 'StringParameterDefinition' },
              ],
            },
          ],
        })
      return
    }
    if (url.pathname === '/job/henan/buildWithParameters' && req.method === 'POST') {
      if (state.buildDenied) {
        json({}, 403)
        return
      }
      let body = ''
      for await (const chunk of req) body += chunk
      const params = new URLSearchParams(body)
      state.requestId = params.get('ARTIFACT_CENTER_REQUEST_ID') ?? ''
      state.count++
      if (state.loseResponse) {
        req.socket.destroy()
        return
      }
      res.writeHead(201, { Location: `${baseUrl}/queue/item/101/` }).end()
      return
    }
    if (url.pathname === '/queue/api/json') {
      json({
        items: state.count
          ? [
              {
                id: 101,
                task: { fullName: 'henan' },
                actions: [
                  {
                    parameters: [
                      { name: 'ARTIFACT_CENTER_REQUEST_ID', value: state.requestId },
                    ],
                  },
                ],
              },
            ]
          : [],
      })
      return
    }
    if (url.pathname === '/queue/item/101/api/json') {
      if (state.queueMissing) {
        json({}, 404)
        return
      }
      json({
        id: 101,
        cancelled: state.cancelled,
        why: state.running ? null : 'Waiting for executor',
        ...(state.running ? { executable: { number: 41 } } : {}),
      })
      return
    }
    if (url.pathname === '/queue/cancelItem') {
      state.cancelled = true
      res.writeHead(302, { Location: '/' }).end()
      return
    }
    if (url.pathname === '/job/henan/41/stop') {
      state.finished = true
      state.cancelled = true
      state.stopCount++
      res.writeHead(302, { Location: '/' }).end()
      return
    }
    if (url.pathname === '/job/henan/41/api/json') {
      json({
        number: 41,
        queueId: 101,
        building: !state.finished,
        result: state.finished ? (state.cancelled ? 'ABORTED' : 'SUCCESS') : null,
        timestamp: Date.now() - 5000,
        duration: 5000,
        artifacts: [
          { fileName: 'app.tar.gz', relativePath: 'artifacts/app.tar.gz' },
          ...(state.dual
            ? [{ fileName: 'outer.tar.gz', relativePath: 'artifacts/outer.tar.gz' }]
            : []),
          { fileName: 'other.txt', relativePath: 'other.txt' },
        ],
        actions: [{ lastBuiltRevision: { SHA1: commit } }],
      })
      return
    }
    if (url.pathname === '/job/henan/41/logText/progressiveText') {
      const text = Buffer.from('Building <script>alert(1)</script>\nSUCCESS\n')
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'X-Text-Size': String(text.length),
        'X-More-Data': String(!state.finished),
      })
      res.end(text.subarray(Number(url.searchParams.get('start'))))
      return
    }
    if (
      [
        '/job/henan/41/artifact/artifacts/app.tar.gz',
        '/job/henan/41/artifact/artifacts/outer.tar.gz',
      ].includes(url.pathname)
    ) {
      if (state.artifactMissing) {
        json({}, 404)
        return
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes.length),
      })
      if (state.artifactBroken) {
        res.write(bytes.subarray(0, 10))
        res.destroy()
        return
      }
      res.end(bytes)
      return
    }
    json({}, 404)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('listen_failed')
  baseUrl = `http://127.0.0.1:${address.port}`
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as { entries: { tag: string }[] }
  for (const entry of journal.entries)
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  for (const role of ['admin', 'maintainer', 'viewer', 'outsider'] as const) {
    const platformRole = role === 'admin' ? 'admin' : 'viewer'
    await query(
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
  await query('INSERT INTO regions (id,code,name) VALUES ($1,$2,$3)', [
    ids.region,
    'build-test',
    'Build test',
  ])
  for (const id of [ids.application, ids.other])
    await query(
      "INSERT INTO applications (id,name,application_code,package_name,platform,region_id) VALUES ($1,'Test app','test','test','linux',$2)",
      [id, ids.region],
    )
  await query(
    "INSERT INTO application_members (application_id,user_id,role) VALUES ($1,$2,'maintainer'),($1,$3,'viewer')",
    [ids.application, ids.maintainer, ids.viewer],
  )
  expect(
    (
      await request('/settings/jenkins', 'PUT', {
        baseUrl,
        username: 'builder',
        token: 'test-token',
        enabled: true,
        revision: 0,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/applications/${ids.application}/build-config`, 'PUT', {
        enabled: true,
        jobPath: 'henan',
        artifactPattern: 'artifacts/*.tar.gz',
        parameters: [{ name: 'buildMode', value: 'test' }],
        revision: 0,
      })
    ).status,
  ).toBe(200)
}, 30_000)
beforeEach(async () => {
  Object.assign(state, {
    count: 0,
    running: false,
    finished: false,
    cancelled: false,
    loseResponse: false,
    queueMissing: false,
    artifactMissing: false,
    artifactBroken: false,
    buildDenied: false,
    requestId: '',
    stopCount: 0,
    dual: false,
  })
  await fixture.client.exec(
    'DELETE FROM application_builds; DELETE FROM artifacts; DELETE FROM releases; DELETE FROM audit_logs;',
  )
  await query("UPDATE applications SET status='active' WHERE id=$1", [ids.application])
  await query("UPDATE applications SET status='active' WHERE id=$1", [ids.other])
  await query("UPDATE application_build_configs SET output_targets='[]'::jsonb")
  await query('DELETE FROM application_members WHERE application_id=$1', [ids.other])
  await query('UPDATE users SET is_active=true,token_version=0 WHERE id=$1', [
    ids.maintainer,
  ])
})
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await fixture.client.close()
  if (
    !path
      .resolve(fixture.storagePath)
      .startsWith(path.join(path.resolve(tmpdir()), 'artifact-jenkins-test-'))
  )
    throw new Error('unsafe_test_cleanup')
  await rm(fixture.storagePath, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

describe('应用构建闭环：真实 HTTP、JWT、数据库及文件传输', () => {
  it('第二台 Jenkins 独立构建，重绑应用后历史下载仍访问原服务器', async () => {
    let secondCalls = 0
    const handler = server.listeners('request')[0] as RequestListener
    const second = createServer((req, res) => {
      secondCalls++
      handler(req, res)
    })
    await new Promise<void>((resolve) => second.listen(0, '127.0.0.1', resolve))
    const address = second.address() as { port: number }
    const secondUrl = `http://127.0.0.1:${address.port}`
    try {
      expect(
        (
          await request('/settings/jenkins/connections/henan-14', 'PUT', {
            baseUrl: secondUrl,
            username: 'builder',
            token: 'test-token',
            name: '河南 14',
            enabled: true,
            revision: 0,
          })
        ).status,
      ).toBe(200)
      await query(
        "UPDATE application_build_configs SET connection_id='henan-14' WHERE application_id=$1",
        [ids.application],
      )
      await query("UPDATE jenkins_connections SET enabled=false WHERE id='default'")
      const run = await completed()
      expect(
        (
          await query(
            'SELECT connection_id,base_url FROM application_builds WHERE id=$1',
            [run.id],
          )
        ).rows,
      ).toEqual([{ connection_id: 'henan-14', base_url: secondUrl }])
      await query(
        "UPDATE application_build_configs SET connection_id='default' WHERE application_id=$1",
        [ids.application],
      )
      const before = secondCalls
      const ticket = await (
        await request(`${buildUrl}/${run.id}/download-ticket`, 'POST', {
          relativePath: publishInput.relativePath,
        })
      ).json()
      const downloaded = await app.request(ticket.url)
      expect(downloaded.status).toBe(200)
      expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes)
      expect(secondCalls).toBeGreaterThan(before)
    } finally {
      await query(
        "UPDATE application_build_configs SET connection_id='default' WHERE application_id=$1",
        [ids.application],
      )
      await query("UPDATE jenkins_connections SET enabled=true WHERE id='default'")
      await query("DELETE FROM jenkins_connections WHERE id='henan-14'")
      await new Promise<void>((resolve) => second.close(() => resolve()))
    }
  })
  it('一次构建的两个文件分别下载并发布到两个应用', async () => {
    state.dual = true
    await query(
      'UPDATE application_build_configs SET output_targets=$1::jsonb WHERE application_id=$2',
      [
        JSON.stringify([
          {
            name: '内屏',
            pattern: 'artifacts/app.tar.gz',
            applicationId: ids.application,
          },
          { name: '外屏', pattern: 'artifacts/outer.tar.gz', applicationId: ids.other },
        ]),
        ids.application,
      ],
    )
    const run = await completed()
    for (const relativePath of ['artifacts/app.tar.gz', 'artifacts/outer.tar.gz']) {
      const ticket = await (
        await request(`${buildUrl}/${run.id}/download-ticket`, 'POST', { relativePath })
      ).json()
      const downloaded = await app.request(ticket.url)
      expect(downloaded.status).toBe(200)
      expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes)
      expect(
        (
          await request(`${buildUrl}/${run.id}/publications`, 'POST', {
            ...publishInput,
            relativePath,
          })
        ).status,
      ).toBe(202)
      await processBuildPublications()
    }
    expect(state.count).toBe(1)
    const rows = (await query('SELECT application_id,status FROM artifacts')).rows
    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        { application_id: ids.application, status: 'beta' },
        { application_id: ids.other, status: 'beta' },
      ]),
    )
  })
  it('产物目标随构建保存；跨应用发布检查目标权限并写入正确应用', async () => {
    await query(
      'UPDATE application_build_configs SET output_targets=$1::jsonb WHERE application_id=$2',
      [
        JSON.stringify([
          { name: '外屏', pattern: 'artifacts/*.tar.gz', applicationId: ids.other },
        ]),
        ids.application,
      ],
    )
    const run = await completed()
    await query("UPDATE application_build_configs SET output_targets='[]'::jsonb")
    const detail = await (await request(`${buildUrl}/${run.id}`)).json()
    expect(detail.build.files[0].targetApplicationId).toBe(ids.other)
    const url = `${buildUrl}/${run.id}/publications`
    expect((await request(url, 'POST', publishInput, 'maintainer')).status).toBe(403)
    expect(
      (
        await request(url, 'POST', {
          ...publishInput,
          targetApplicationId: ids.application,
        })
      ).status,
    ).toBe(400)
    expect((await request(url, 'POST', publishInput)).status).toBe(202)
    await processBuildPublications()
    const rows = (
      await query('SELECT application_id, storage_key, status FROM artifacts')
    ).rows
    expect(rows).toEqual([
      expect.objectContaining({
        application_id: ids.other,
        status: 'beta',
        storage_key: expect.stringContaining(ids.other),
      }),
    ])
    expect(
      (await (await request(`${buildUrl}/${run.id}`)).json()).publications[0]
        .targetApplicationId,
    ).toBe(ids.other)
  })
  it('排队发布后撤销目标应用权限时停止导入', async () => {
    await query(
      'UPDATE application_build_configs SET output_targets=$1::jsonb WHERE application_id=$2',
      [
        JSON.stringify([
          { name: '外屏', pattern: 'artifacts/*.tar.gz', applicationId: ids.other },
        ]),
        ids.application,
      ],
    )
    await query(
      "INSERT INTO application_members(application_id,user_id,role) VALUES($1,$2,'maintainer')",
      [ids.other, ids.maintainer],
    )
    const run = await completed()
    expect(
      (
        await request(
          `${buildUrl}/${run.id}/publications`,
          'POST',
          publishInput,
          'maintainer',
        )
      ).status,
    ).toBe(202)
    await query('DELETE FROM application_members WHERE application_id=$1', [ids.other])
    await processBuildPublications()
    expect((await query('SELECT * FROM artifacts')).rows).toHaveLength(0)
    expect(
      (await (await request(`${buildUrl}/${run.id}`)).json()).publications[0].status,
    ).toBe('failed')
  })
  it.each([
    { patterns: [] as string[] },
    { patterns: ['artifacts/*.tar.gz', 'artifacts/**'] },
  ])('目标规则未命中或重叠时不回退当前应用：%j', async ({ patterns }) => {
    const targets = (patterns.length ? patterns : ['unmatched/*.apk']).map((pattern) => ({
      name: '外屏',
      pattern,
      applicationId: ids.other,
    }))
    await query(
      'UPDATE application_build_configs SET output_targets=$1::jsonb WHERE application_id=$2',
      [JSON.stringify(targets), ids.application],
    )
    const run = await completed()
    expect(
      (await request(`${buildUrl}/${run.id}/publications`, 'POST', publishInput)).status,
    ).toBe(409)
    expect((await query('SELECT * FROM build_publications')).rows).toHaveLength(0)
  })
  it('相同微秒时间的构建分页不遗漏或重复', async () => {
    const run = await completed()
    for (let i = 0; i < 24; i++)
      await query(
        `INSERT INTO application_builds (application_id, request_key, requested_by_name, base_url, username, job_path, config_revision, artifact_pattern, parameters, status, created_at) SELECT application_id,$2,requested_by_name,base_url,username,job_path,config_revision,artifact_pattern,parameters,'success','2026-10-13 01:00:00.123456' FROM application_builds WHERE id=$1`,
        [run.id, randomUUID()],
      )
    const first = await (await request(buildUrl)).json()
    const second = await (await request(`${buildUrl}?before=${first.nextCursor}`)).json()
    expect(first.items).toHaveLength(20)
    expect(second.items).toHaveLength(5)
    expect(
      new Set([...first.items, ...second.items].map((item: { id: string }) => item.id))
        .size,
    ).toBe(25)
    expect(second.nextCursor).toBeNull()
  })
  it('无请求标识时提交状态保持未确认，显式确认前不允许重新发起', async () => {
    state.loseResponse = true
    const run = await enqueue()
    await due()
    state.requestId = ''
    await due()
    expect((await (await request(`${buildUrl}/${run.id}`)).json()).build.status).toBe(
      'unknown',
    )
    expect(
      (
        await request(buildUrl, 'POST', {
          requestKey: randomUUID(),
          configRevision: 1,
          parameters: [{ name: 'buildMode', value: 'test' }],
        })
      ).status,
    ).toBe(409)
    expect(state.count).toBe(1)
  })
  it('Jenkins 明确拒绝不重试；传输中断不生成不完整制品', async () => {
    state.buildDenied = true
    const denied = await enqueue()
    await due()
    expect((await (await request(`${buildUrl}/${denied.id}`)).json()).build.status).toBe(
      'failure',
    )
    expect(state.count).toBe(0)
    state.buildDenied = false
    const run = await completed()
    state.artifactBroken = true
    await request(`${buildUrl}/${run.id}/publications`, 'POST', publishInput)
    await processBuildPublications()
    expect((await query('SELECT * FROM artifacts')).rows).toHaveLength(0)
    expect(
      (await (await request(`${buildUrl}/${run.id}`)).json()).publications[0].status,
    ).toBe('failed')
  })
  it('构建提交幂等，实际队列转运行、成功，日志与下载只绑定本次构建', async () => {
    const key = randomUUID()
    const run = await enqueue(key)
    expect((await enqueue(key)).id).toBe(run.id)
    expect(state.count).toBe(0)
    await due()
    expect(state.count).toBe(1)
    await due()
    expect((await (await request(`${buildUrl}/${run.id}`)).json()).build.status).toBe(
      'queued',
    )
    state.running = true
    await due()
    expect((await (await request(`${buildUrl}/${run.id}`)).json()).build.status).toBe(
      'running',
    )
    state.finished = true
    await due()
    const detail = await (await request(`${buildUrl}/${run.id}`)).json()
    expect(detail.build).toMatchObject({
      status: 'success',
      buildNumber: 41,
      commits: [commit],
      files: [{ fileName: 'app.tar.gz', relativePath: 'artifacts/app.tar.gz' }],
    })
    const log = await (await request(`${buildUrl}/${run.id}/log?start=0`)).json()
    expect(log.text).toContain('<script>')
    expect(
      (await (await request(`${buildUrl}/${run.id}/log?start=${log.nextStart}`)).json())
        .text,
    ).toBe('')
    const ticket = await (
      await request(
        `${buildUrl}/${run.id}/download-ticket`,
        'POST',
        { relativePath: 'artifacts/app.tar.gz' },
        'maintainer',
      )
    ).json()
    const downloaded = await app.request(ticket.url)
    expect(downloaded.status).toBe(200)
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes)
    expect(downloaded.headers.get('content-disposition')).toContain('app.tar.gz')
    expect(state.count).toBe(1)
  })
  it('Jenkins 接收后断网，恢复时按请求编号核对，绝不重复 POST', async () => {
    state.loseResponse = true
    const run = await enqueue()
    await due()
    expect(state.count).toBe(1)
    expect((await (await request(`${buildUrl}/${run.id}`)).json()).build.status).toBe(
      'unknown',
    )
    state.loseResponse = false
    await due()
    expect((await (await request(`${buildUrl}/${run.id}`)).json()).build.status).toBe(
      'queued',
    )
    expect(state.count).toBe(1)
  })
  it('进程在提交后重启，只核对已有请求；队列过期后按 queueId 找回构建', async () => {
    const run = await enqueue()
    await due()
    await query(
      "UPDATE application_builds SET status='submitting',queue_id=NULL,lease_id=$2,lease_until='2000-01-01' WHERE id=$1",
      [run.id, randomUUID()],
    )
    await due()
    state.queueMissing = true
    state.running = true
    state.finished = true
    await due()
    expect((await (await request(`${buildUrl}/${run.id}`)).json()).build.status).toBe(
      'success',
    )
    expect(state.count).toBe(1)
  })
  it('重复点击发布只产生一个任务和制品，文件完整、SHA256 正确且不替换最新', async () => {
    const run = await completed()
    const url = `${buildUrl}/${run.id}/publications`
    const first = await (await request(url, 'POST', publishInput, 'maintainer')).json()
    const second = await (await request(url, 'POST', publishInput, 'maintainer')).json()
    expect(first.publication.id).toBe(second.publication.id)
    expect(first.publication.status).toBe('pending')
    await processBuildPublications()
    const rows = (
      await fixture.client.query<{
        storage_key: string
        sha256: string
        status: string
        build_meta: unknown
      }>('SELECT * FROM artifacts')
    ).rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      status: 'beta',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      build_meta: expect.objectContaining({
        buildId: run.id,
        buildNumber: 41,
        commits: [commit],
      }),
    })
    expect(await readFile(path.join(fixture.storagePath, rows[0].storage_key))).toEqual(
      bytes,
    )
    expect(
      (await (await request(url, 'POST', publishInput)).json()).publication.status,
    ).toBe('published')
    expect(
      (await request(url, 'POST', { ...publishInput, version: '2.0.0' })).status,
    ).toBe(409)
    expect((await query('SELECT * FROM artifacts')).rows).toHaveLength(1)
  })
  it('文件清理或传输失败不入库，显式重试可恢复；正式版必须确认', async () => {
    const run = await completed()
    const url = `${buildUrl}/${run.id}/publications`
    expect(
      (await request(url, 'POST', { ...publishInput, channel: 'stable' })).status,
    ).toBe(400)
    state.artifactMissing = true
    await request(url, 'POST', publishInput)
    await processBuildPublications()
    expect(
      (await (await request(`${buildUrl}/${run.id}`)).json()).publications[0].status,
    ).toBe('failed')
    expect((await query('SELECT * FROM artifacts')).rows).toHaveLength(0)
    state.artifactMissing = false
    await request(url, 'POST', {
      ...publishInput,
      channel: 'stable',
      confirmStable: true,
    })
    await processBuildPublications()
    expect((await query('SELECT status FROM artifacts')).rows[0]).toEqual({
      status: 'stable',
    })
  })
  it('取消未提交、排队中和正在运行的任务，等待 Jenkins 确认最终状态', async () => {
    const pending = await enqueue()
    await request(`${buildUrl}/${pending.id}/cancel`, 'POST')
    await due()
    expect(state.count).toBe(0)
    expect((await (await request(`${buildUrl}/${pending.id}`)).json()).build.status).toBe(
      'aborted',
    )
    const queued = await enqueue()
    await due()
    await request(`${buildUrl}/${queued.id}/cancel`, 'POST')
    await due()
    await due()
    expect((await (await request(`${buildUrl}/${queued.id}`)).json()).build.status).toBe(
      'aborted',
    )
    state.cancelled = false
    const running = await enqueue()
    await due()
    state.running = true
    await due()
    await request(`${buildUrl}/${running.id}/cancel`, 'POST')
    await due()
    await due()
    expect(state.stopCount).toBe(1)
    expect((await (await request(`${buildUrl}/${running.id}`)).json()).build.status).toBe(
      'aborted',
    )
  })
  it('构建权限按应用隔离；路径伪造、普通查看者、失效票据和下载票据越权均失败', async () => {
    const run = await completed()
    for (const role of ['viewer', 'outsider']) {
      expect((await request(buildUrl, 'GET', undefined, role)).status).toBe(403)
      expect(
        (await request(`${buildUrl}/${run.id}/log`, 'GET', undefined, role)).status,
      ).toBe(403)
      expect(
        (await request(`${buildUrl}/${run.id}/publications`, 'POST', publishInput, role))
          .status,
      ).toBe(403)
    }
    expect((await request(`/applications/${ids.other}/builds/${run.id}`)).status).toBe(
      404,
    )
    expect(
      (
        await request(`${buildUrl}/${run.id}/download-ticket`, 'POST', {
          relativePath: '../secret',
        })
      ).status,
    ).toBe(409)
    const { url } = await (
      await request(
        `${buildUrl}/${run.id}/download-ticket`,
        'POST',
        { relativePath: publishInput.relativePath },
        'maintainer',
      )
    ).json()
    const ticket = url.split('/').at(-1)
    expect((await request(buildUrl, 'GET', undefined, ticket)).status).toBe(401)
    await query('UPDATE users SET token_version=1 WHERE id=$1', [ids.maintainer])
    expect((await app.request(url)).status).toBe(401)
  })
  it('发起后归档应用或撤销权限，后台不得继续提交或发布', async () => {
    const run = await enqueue()
    await query("UPDATE applications SET status='archived' WHERE id=$1", [
      ids.application,
    ])
    await due()
    expect(state.count).toBe(0)
    expect((await (await request(`${buildUrl}/${run.id}`)).json()).build.status).toBe(
      'failure',
    )
    await query("UPDATE applications SET status='active' WHERE id=$1", [ids.application])
    const ready = await completed()
    await request(
      `${buildUrl}/${ready.id}/publications`,
      'POST',
      publishInput,
      'maintainer',
    )
    await query('UPDATE users SET is_active=false WHERE id=$1', [ids.maintainer])
    await processBuildPublications()
    expect((await query('SELECT * FROM artifacts')).rows).toHaveLength(0)
    expect(
      (await (await request(`${buildUrl}/${ready.id}`)).json()).publications[0].status,
    ).toBe('failed')
  })
})
