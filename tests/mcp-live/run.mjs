import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'

const api = process.env.MCP_E2E_API_URL
const clientFile = resolve(
  process.env.MCP_E2E_CLIENT || 'output/mcp-live-20261020/client.mjs',
)
const out = resolve(process.env.MCP_E2E_OUTPUT || 'output/mcp-live-20261020')
assert.equal(
  process.env.MCP_TEST_OWNED_ENV,
  '1',
  'Requires explicit test-owned isolated environment',
)
assert.equal(
  new URL(api).hostname,
  '127.0.0.1',
  'Use a loopback tunnel to the isolated API only',
)
await mkdir(out, { recursive: true })
const results = [],
  sessions = [],
  passedTools = new Set(),
  discovered = []
const started = new Date().toISOString()
let directory
class ToolError extends Error {
  constructor(name, value) {
    super(`${name}: ${value.message || JSON.stringify(value)}`)
    this.status = value.status
    this.code = value.code
  }
}
async function http(path, token, method = 'GET', body) {
  const response = await fetch(api + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  })
  const json = (response.headers.get('content-type') || '').includes('application/json')
  const value = json ? await response.json() : Buffer.from(await response.arrayBuffer())
  return { status: response.status, value }
}
async function login(identifier, password) {
  const r = await http('/auth/login', null, 'POST', { identifier, password })
  assert.equal(r.status, 200, 'Synthetic isolated login must succeed')
  return r.value.token
}
async function mint(jwt, name) {
  const r = await http('/account/mcp-credentials', jwt, 'POST', { name, validDays: 1 })
  assert.equal(r.status, 201)
  return r.value
}
class Mcp {
  constructor(token) {
    this.pending = new Map()
    this.seq = 0
    this.child = spawn(process.execPath, [clientFile], {
      windowsHide: true,
      env: { ...process.env, ARTIFACT_CENTER_URL: api, ARTIFACT_CENTER_TOKEN: token },
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    createInterface({ input: this.child.stdout }).on('line', (line) => {
      const value = JSON.parse(line),
        pending = this.pending.get(value.id)
      if (!pending) return
      this.pending.delete(value.id)
      clearTimeout(pending.timer)
      if (value.error)
        pending.reject(new Error(`MCP protocol error: ${value.error.message}`))
      else pending.resolve(value.result)
    })
    sessions.push(this)
  }
  rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} timeout`))
      }, 30000)
      this.pending.set(id, { resolve, reject, timer })
      this.child.stdin.write(
        JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n',
      )
    })
  }
  async init() {
    await this.rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'isolated-feature-regression', version: '1.0.0' },
    })
    this.child.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n',
    )
    return this
  }
  async call(
    name,
    args = {},
    verify = (value) => assert(value && typeof value === 'object'),
    expectedStatus,
  ) {
    const start = Date.now()
    try {
      const result = await this.rpc('tools/call', {
        name: `artifact_center_${name}`,
        arguments: args,
      })
      let value = result.structuredContent
      if (value === undefined) {
        const text = result.content?.find((x) => x.type === 'text')?.text || ''
        try {
          value = JSON.parse(text)
        } catch {
          value = { message: text }
        }
      }
      if (expectedStatus !== undefined) {
        assert.equal(result.isError, true, `${name} should reject`)
        assert.equal(value.status, expectedStatus, `${name}: ${JSON.stringify(value)}`)
        results.push({
          tool: name,
          verdict: 'pass',
          scenario: `reject-${expectedStatus}`,
          ms: Date.now() - start,
        })
        return value
      }
      if (result.isError) throw new ToolError(name, value)
      await verify(value)
      const firstPass = !passedTools.has(name)
      passedTools.add(name)
      results.push({
        tool: name,
        verdict: 'pass',
        scenario: 'success-and-effect',
        ms: Date.now() - start,
      })
      if (firstPass) console.log(`PASS ${name}`)
      return value
    } catch (error) {
      results.push({
        tool: name,
        verdict: error instanceof ToolError ? 'product-fail' : 'test-fail',
        message: error.message,
        ms: Date.now() - start,
      })
      throw error
    }
  }
  stop() {
    this.child.kill()
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Session closed'))
    }
    this.pending.clear()
  }
}
const eq = (key, expected) => (value) => assert.equal(value[key], expected)
const items = (value) => assert(Array.isArray(value.items))
async function waitFor(name, read, predicate, ms = 90000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    const value = await read()
    if (predicate(value)) return value
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(`Timed out: ${name}`)
}
try {
  const adminJwt = await login('mcp-e2e-admin', 'Only-Isolated-Test42!')
  assert.equal((await http('/auth/me', adminJwt)).value.user.username, 'mcp-e2e-admin')
  const primary = await mint(adminJwt, 'Owned regression driver')
  const m = await new Mcp(primary.token).init()
  discovered.push(
    ...(await m.rpc('tools/list', {})).tools.map((t) =>
      t.name.replace(/^artifact_center_/, ''),
    ),
  )
  assert.equal(discovered.length, 81)
  const identity = await m.call('whoami', {}, (v) =>
    assert.equal(v.user.username, 'mcp-e2e-admin'),
  )
  const adminId = identity.user.id
  await m.call('check_authorization', {}, (v) => assert.equal(v.user.id, adminId))
  await m.call('update_profile', { body: { name: 'Owned MCP Admin Updated' } }, (v) => {
    assert.equal(v.user.name, 'Owned MCP Admin Updated')
    assert(!v.token)
  })
  await m.call('whoami', {}, (v) => assert.equal(v.user.name, 'Owned MCP Admin Updated'))

  const user = (
    await m.call(
      'create_user',
      {
        body: {
          name: 'Owned viewer',
          username: 'mcp-owned-viewer',
          email: 'viewer@mcp-e2e.test',
          password: 'Owned-Viewer-Test42!',
          role: 'viewer',
        },
      },
      (v) => assert.equal(v.user.role, 'viewer'),
    )
  ).user
  await m.call('get_user', { userId: user.id }, (v) => {
    assert.equal(v.user.id, user.id)
    assert(!v.user.passwordHash)
  })
  await m.call('list_users', {}, (v) => assert(v.items.some((x) => x.id === user.id)))
  await m.call(
    'update_user',
    { userId: user.id, body: { name: 'Owned viewer renamed' } },
    (v) => assert.equal(v.user.name, 'Owned viewer renamed'),
  )
  await m.call('get_user', { userId: user.id }, (v) =>
    assert.equal(v.user.name, 'Owned viewer renamed'),
  )
  await m.call(
    'reset_user_password',
    { userId: user.id, body: { password: 'Reset-Viewer-Test42!' } },
    eq('ok', true),
  )
  let viewerJwt = await login('mcp-owned-viewer', 'Reset-Viewer-Test42!')
  const viewerCred = await mint(viewerJwt, 'Owned permission actor')
  const viewer = await new Mcp(viewerCred.token).init()
  await viewer.call('list_users', {}, undefined, 403)
  const product = (
    await m.call(
      'create_product',
      { body: { code: 'mcp-e2e', name: 'Owned MCP product' } },
      (v) => assert.equal(v.region.code, 'mcp-e2e'),
    )
  ).region
  await m.call(
    'update_product',
    { productId: product.id, body: { name: 'Owned MCP product edited' } },
    (v) => assert.equal(v.region.name, 'Owned MCP product edited'),
  )
  await m.call('list_products', {}, (v) =>
    assert(
      v.items.some((x) => x.id === product.id && x.name === 'Owned MCP product edited'),
    ),
  )
  const initialProjects = await m.call(
    'list_projects',
    { query: { productId: product.id } },
    items,
  )
  const defaultProject = initialProjects.items.find((x) => x.isDefault)
  assert(defaultProject)
  const p1 = (
    await m.call(
      'create_project',
      { body: { productId: product.id, name: 'Owned P1', code: 'mcp-one' } },
      (v) => assert.equal(v.project.code, 'mcp-one'),
    )
  ).project
  const p2 = (
    await m.call(
      'create_project',
      { body: { productId: product.id, name: 'Owned P2' } },
      (v) => assert(v.project.id),
    )
  ).project
  await m.call(
    'update_project',
    { projectId: p1.id, body: { name: 'Owned P1 edited' } },
    (v) => assert.equal(v.project.name, 'Owned P1 edited'),
  )
  const order = (
    await m.call('list_projects', { query: { productId: product.id } }, items)
  ).items.map((x) => x.id)
  await m.call('reorder_projects', {
    body: {
      productId: product.id,
      expectedOrder: order,
      projectIds: [...order].reverse(),
    },
  })
  await m.call('list_projects', { query: { productId: product.id } }, (v) =>
    assert.deepEqual(
      v.items.map((x) => x.id),
      [...order].reverse(),
    ),
  )
  await viewer.call(
    'create_project',
    { body: { productId: product.id, name: 'Must reject' } },
    undefined,
    403,
  )

  directory = await mkdtemp(join(out, 'owned-git-'))
  const git = (...args) =>
    execFileSync('git', ['-C', directory, ...args], { windowsHide: true, stdio: 'pipe' })
  git('init', '-b', 'main')
  git('remote', 'add', 'origin', 'https://mcp-e2e.test/team/app.git')
  await writeFile(
    join(directory, 'artifact-center.release.json'),
    JSON.stringify({
      commands: { build: 'node -e "console.log(1)"' },
      artifact: { path: 'mcp.zip', platform: 'linux' },
      version: { file: 'package.json', jsonPath: 'version' },
      buildNumber: { file: 'package.json', jsonPath: 'buildNumber' },
    }),
  )
  await writeFile(
    join(directory, 'package.json'),
    '{"version":"1.0.0","buildNumber":"1"}',
  )
  await writeFile(join(directory, '.gitignore'), 'mcp.zip\n')
  git('add', '.')
  git(
    '-c',
    'user.name=MCP E2E',
    '-c',
    'user.email=test@mcp-e2e.test',
    'commit',
    '-m',
    'Owned test fixture',
  )
  const bytes = Buffer.from('MCP fixture artifact, isolated, not a production package\n')
  await writeFile(join(directory, 'mcp.zip'), bytes)
  const binding = {
    repository: 'https://mcp-e2e.test/team/app.git',
    branch: 'main',
    directory: '',
  }
  const app = (
    await m.call(
      'create_application',
      {
        body: {
          name: 'Owned MCP application',
          applicationCode: 'owned-mcp',
          description: 'Isolated test data',
          packageName: 'test.owned.mcp',
          platform: 'linux',
          regionId: product.id,
          projectId: p1.id,
          repositoryBindings: [binding],
        },
      },
      (v) => assert.equal(v.application.platform, 'linux'),
    )
  ).application
  await viewer.call('application_details', { applicationId: app.id }, undefined, 403)
  await m.call(
    'edit_application',
    { applicationId: app.id, body: { description: 'Edited isolated application' } },
    (v) => assert.equal(v.application.description, 'Edited isolated application'),
  )
  await m.call('application_details', { applicationId: app.id }, (v) =>
    assert.equal(v.application.description, 'Edited isolated application'),
  )
  await m.call('browse_applications', { query: { q: 'Owned MCP' } }, (v) =>
    assert(v.items.some((x) => x.id === app.id)),
  )
  await m.call('application_summary', {}, (v) => assert(v.total >= 1))
  await m.call('bulk_application_codes', {
    body: { updates: [{ id: app.id, applicationCode: 'mcp-edited' }] },
  })
  await m.call('bulk_application_appearance', {
    body: { applicationIds: [app.id], iconKey: 'package', iconColor: 'mint' },
  })
  await m.call('application_details', { applicationId: app.id }, (v) => {
    assert.equal(v.application.applicationCode, 'mcp-edited')
    assert.equal(v.application.iconColor, 'mint')
  })
  await m.call(
    'member_candidates',
    { applicationId: app.id, query: { q: 'Owned' } },
    items,
  )
  await m.call('set_application_member', {
    applicationId: app.id,
    userId: user.id,
    body: { role: 'viewer' },
  })
  await m.call('list_application_members', { applicationId: app.id }, (v) =>
    assert(v.items.some((x) => x.id === user.id || x.userId === user.id)),
  )
  await viewer.call('application_details', { applicationId: app.id }, (v) =>
    assert.equal(v.application.id, app.id),
  )
  await m.call('remove_application_member', { applicationId: app.id, userId: user.id })
  await viewer.call('application_details', { applicationId: app.id }, undefined, 403)
  await m.call('set_access_grants', {
    body: {
      operation: 'set',
      userId: user.id,
      applicationIds: [app.id],
      role: 'maintainer',
    },
  })
  await m.call('get_access_grants', { userId: user.id }, (v) =>
    assert(v.items.some((x) => x.applicationId === app.id)),
  )
  await viewer.call('list_applications', {}, (v) =>
    assert(v.items.some((x) => x.id === app.id)),
  )
  await m.call('set_access_grants', {
    body: { operation: 'remove', userId: user.id, applicationIds: [app.id] },
  })
  await viewer.call('application_details', { applicationId: app.id }, undefined, 403)

  await m.call('list_applications', { query: 'Owned MCP' }, (v) =>
    assert(v.items.some((x) => x.id === app.id)),
  )
  await m.call('get_application', { applicationId: app.id }, (v) =>
    assert.equal(v.target.applicationId, app.id),
  )
  await m.call('match_repository', { directory }, (v) => {
    assert.equal(v.items.length, 1)
    assert.equal(v.items[0].id, app.id)
    assert(v.buildRecipe)
  })
  const beforeUpload = await m.call('list_artifacts', { applicationId: app.id }, (v) =>
    assert.equal(v.items.length, 0),
  )
  assert(beforeUpload)
  const publish = async (version) => {
    const preview = await m.call(
      'prepare_upload',
      {
        directory,
        applicationId: app.id,
        filePath: join(directory, 'mcp.zip'),
        version,
        buildNumber: version,
        platform: 'linux',
        channel: 'beta',
        releaseNotes: 'Owned test upload',
      },
      (v) => {
        assert(v.planId)
        assert.equal(v.sha256, createHash('sha256').update(bytes).digest('hex'))
      },
    )
    const countBefore = (await m.call('list_artifacts', { applicationId: app.id }, items))
      .items.length
    // Synthetic host confirmation, explicitly restricted to this owned fixture.
    const uploaded = await m.call(
      'upload_artifact',
      { planId: preview.planId, confirmed: true },
      (v) => {
        assert.equal(v.available, true)
        assert.equal(v.artifact.sha256, preview.sha256)
      },
    )
    await m.call('list_artifacts', { applicationId: app.id }, (v) =>
      assert.equal(v.items.length, countBefore + 1),
    )
    return uploaded.artifact
  }
  const artifact = await publish('1.0.0')
  await m.call('get_artifact', { artifactId: artifact.id }, (v) =>
    assert.equal(v.artifact.id, artifact.id),
  )
  await m.call('update_artifact', {
    artifactId: artifact.id,
    releaseNotes: 'Owned release notes edited',
    promoteToStable: true,
    confirmStablePromotion: true,
  })
  await m.call('get_artifact', { artifactId: artifact.id }, (v) => {
    assert.equal(v.artifact.channel, 'stable')
    assert.equal(v.artifact.releaseNotes, 'Owned release notes edited')
  })
  await m.call('manage_artifact', { artifactId: artifact.id, body: { markLatest: true } })
  await m.call('application_overview', { applicationId: app.id }, (v) =>
    assert(JSON.stringify(v).includes(artifact.id)),
  )
  const releases = await m.call('list_releases', { applicationId: app.id }, (v) =>
    assert(v.items.length > 0),
  )
  await m.call('edit_release', {
    applicationId: app.id,
    releaseId: releases.items[0].id,
    body: { releaseNotes: 'Owned shared release note' },
  })
  await m.call('get_artifact', { artifactId: artifact.id }, (v) =>
    assert.equal(v.artifact.releaseNotes, 'Owned shared release note'),
  )
  const ticket = await m.call(
    'artifact_download_ticket',
    { artifactId: artifact.id },
    (v) => assert(v.url.startsWith('/downloads/')),
  )
  const downloaded = await http(ticket.url)
  assert.equal(downloaded.status, 200)
  assert.deepEqual(downloaded.value, bytes)
  const share = (
    await m.call(
      'create_share',
      {
        applicationId: app.id,
        body: { mode: 'artifact', artifactId: artifact.id, expiresInDays: 1 },
      },
      (v) => assert(v.share.token),
    )
  ).share
  assert.equal((await http(`/public/shares/${share.token}`)).status, 200)
  const collection = (
    await m.call(
      'create_share_collection',
      {
        body: {
          title: 'Owned collection',
          regionId: product.id,
          items: [{ applicationId: app.id, mode: 'latest' }],
          expiresInDays: 1,
        },
      },
      (v) => assert(v.share.token),
    )
  ).share
  assert.equal((await http(`/public/shares/${collection.token}`)).status, 200)
  await m.call('list_shares', { applicationId: app.id }, (v) => {
    assert(v.items.some((x) => x.id === share.id))
    assert(v.items.every((x) => !x.token))
  })
  await m.call('revoke_share', { shareId: share.id })
  assert.notEqual((await http(`/public/shares/${share.token}`)).status, 200)
  await m.call('revoke_share', { shareId: collection.id })
  await m.call('search', { query: { q: 'Owned MCP' } }, (v) =>
    assert(JSON.stringify(v).includes(app.id)),
  )
  await m.call('set_favorite', { applicationId: app.id, body: { favorite: true } })
  await m.call('record_visit', { applicationId: app.id })
  await m.call('set_workspace_preferences', {
    body: {
      platform: 'linux',
      query: 'Owned',
      favoriteOnly: true,
      regionId: product.id,
      projectId: p1.id,
    },
  })
  await m.call('get_workspace', {}, (v) => {
    assert(v.favoriteApplicationIds?.includes(app.id))
    assert.equal(v.preferences.query, 'Owned')
    assert(v.recentApplications.some((x) => x.applicationId === app.id))
  })
  await m.call('list_audit', { query: { applicationId: app.id, limit: 200 } }, (v) =>
    assert(
      v.items.some((x) => x.action === 'artifact.upload' && x.meta?.source === 'mcp'),
    ),
  )

  const serverNow = Date.parse((await http('/health')).value.time)
  const releaseCredential = await m.call(
    'create_release_credential',
    {
      body: {
        name: 'Owned limited credential',
        expiresAt: new Date(serverNow + 3600000).toISOString(),
      },
    },
    (v) => assert(v.token.startsWith('acrt_')),
  )
  await m.call('list_release_credentials', {}, (v) => {
    assert(v.items.some((x) => x.id === releaseCredential.credential.id))
    assert(!JSON.stringify(v).includes(releaseCredential.token))
  })
  const limited = await new Mcp(releaseCredential.token).init()
  await limited.call('list_users', {}, undefined, undefined).then(
    () => {
      throw new Error('Limited credential unexpectedly managed accounts')
    },
    (error) => {
      assert(error.message.includes('account-bound'))
      results.pop()
    },
  )
  await m.call(
    'revoke_release_credential',
    { credentialId: releaseCredential.credential.id },
    eq('ok', true),
  )
  await limited.call('check_authorization', {}, undefined, 401)
  const extraCredential = await mint(adminJwt, 'Owned revocation case')
  await m.call('list_mcp_credentials', {}, (v) => {
    assert(v.items.some((x) => x.id === extraCredential.credential.id))
    assert(!JSON.stringify(v).includes(extraCredential.token))
  })
  await m.call(
    'revoke_mcp_credential',
    { credentialId: extraCredential.credential.id },
    eq('ok', true),
  )
  assert.equal((await http('/auth/me', extraCredential.token)).status, 401)
  const upload = await http(`/applications/${app.id}/uploads`, primary.token, 'POST', {
    resumeKey: randomUUID(),
    filename: 'owned-cancel.zip',
    sizeBytes: 10,
    version: 'cancel',
    buildNumber: 'cancel',
    platform: 'linux',
    channel: 'beta',
    markLatest: false,
  })
  assert.equal(upload.status, 201)
  await m.call('get_upload', { uploadId: upload.value.upload.uploadId }, (v) =>
    assert.equal(v.upload.uploadId, upload.value.upload.uploadId),
  )
  await m.call('cancel_upload', { uploadId: upload.value.upload.uploadId })
  await m.call('get_upload', { uploadId: upload.value.upload.uploadId }, undefined, 404)

  const connection = {
    baseUrl: 'http://mcp-jenkins:8080',
    username: 'builder',
    token: 'e2e-only-token',
    enabled: true,
    revision: 0,
  }
  await m.call('get_jenkins', {}, (v) => assert.equal(v.connection, null))
  await m.call('test_jenkins', { body: connection }, eq('ok', true))
  await m.call('set_jenkins', { body: connection })
  const savedConnection = await m.call('get_jenkins', {}, (v) => {
    assert.equal(v.connection.hasToken, true)
    assert(!JSON.stringify(v).includes('e2e-only-token'))
  })
  assert(savedConnection)
  const buildConfig = {
    enabled: true,
    jobPath: 'mcp-test',
    artifactPattern: 'artifacts/*.zip',
    parameters: [{ name: 'MODE', value: 'success' }],
    revision: 0,
    outputTargets: [],
  }
  await m.call('get_build_config', { applicationId: app.id })
  await m.call('test_build_config', { applicationId: app.id, body: buildConfig })
  await m.call('set_build_config', { applicationId: app.id, body: buildConfig })
  const config = await m.call('get_build_config', { applicationId: app.id }, (v) =>
    assert(v.config?.enabled || v.configuration?.enabled),
  )
  const configRevision = (config.config || config.configuration).revision
  const build = (
    await m.call(
      'start_build',
      {
        applicationId: app.id,
        body: {
          requestKey: randomUUID(),
          configRevision,
          parameters: [{ name: 'MODE', value: 'success' }],
        },
      },
      (v) => assert(v.build.id),
    )
  ).build
  const completed = await waitFor(
    'build completion',
    () => m.call('get_build', { applicationId: app.id, buildId: build.id }),
    (v) => v.build.status === 'success',
  )
  assert(completed.build.files.some((x) => x.relativePath === 'artifacts/mcp.zip'))
  await m.call('list_builds', { applicationId: app.id }, (v) =>
    assert(v.items.some((x) => x.id === build.id)),
  )
  await m.call('get_build_log', { applicationId: app.id, buildId: build.id }, (v) =>
    assert(v.text.includes('SIMULATED Jenkins')),
  )
  const buildTicket = await m.call(
    'build_download_ticket',
    {
      applicationId: app.id,
      buildId: build.id,
      body: { relativePath: 'artifacts/mcp.zip' },
    },
    (v) => assert(v.url),
  )
  const buildBytes = await http(buildTicket.url)
  assert.equal(buildBytes.status, 200)
  assert.equal(buildBytes.value.toString(), 'MCP isolated build artifact bytes\n')
  await m.call(
    'publish_build',
    {
      applicationId: app.id,
      buildId: build.id,
      body: { relativePath: 'artifacts/mcp.zip', version: 'build-1', channel: 'beta' },
    },
    (v) => assert(v.publication.id),
  )
  const published = await waitFor(
    'build publication',
    () => m.call('get_build', { applicationId: app.id, buildId: build.id }),
    (v) => v.publications.some((x) => x.status === 'success' || x.status === 'published'),
  )
  const publishedId = published.publications.find((x) => x.artifactId).artifactId
  await m.call('get_artifact', { artifactId: publishedId }, (v) =>
    assert.equal(v.artifact.version, 'build-1'),
  )
  const cancelBuild = (
    await m.call(
      'start_build',
      {
        applicationId: app.id,
        body: {
          requestKey: randomUUID(),
          configRevision,
          parameters: [{ name: 'MODE', value: 'wait' }],
        },
      },
      (v) => assert(v.build.id),
    )
  ).build
  await m.call('cancel_build', { applicationId: app.id, buildId: cancelBuild.id })
  await waitFor(
    'build cancellation',
    () => m.call('get_build', { applicationId: app.id, buildId: cancelBuild.id }),
    (v) => v.build.status === 'aborted',
  )
  await m.call('set_build_config', {
    applicationId: app.id,
    body: { ...buildConfig, enabled: false, revision: configRevision },
  })
  await m.call(
    'start_build',
    {
      applicationId: app.id,
      body: {
        requestKey: randomUUID(),
        configRevision: configRevision + 1,
        parameters: [],
      },
    },
    undefined,
    409,
  )
  await m.call('set_jenkins', {
    body: {
      ...connection,
      token: undefined,
      enabled: false,
      revision: savedConnection.connection.revision,
    },
  })
  await m.call('get_jenkins', {}, (v) => assert.equal(v.connection.enabled, false))

  await m.call('delete_artifact', { artifactId: publishedId }, eq('ok', true))
  await m.call('get_artifact', { artifactId: publishedId }, undefined, 404)
  const originalRetention = await m.call('get_retention', {}, (v) => assert(v.retention))
  await m.call('set_retention', { body: { maxVersions: 99, archiveDeprecatedDays: 90 } })
  await publish('2.0.0')
  await m.call('set_retention', { body: { maxVersions: 1 } })
  await m.call('run_retention', {}, (v) => assert(v.report.deletedVersions >= 1))
  await m.call('list_artifacts', { applicationId: app.id }, (v) => {
    assert.equal(v.items.length, 1)
    assert.equal(v.items[0].id, artifact.id)
  })
  assert(originalRetention)
  await m.call('delete_application', { applicationId: app.id }, eq('ok', true))
  await m.call('application_details', { applicationId: app.id }, undefined, 404)
  await m.call('delete_project', { projectId: p1.id }, eq('ok', true))
  await m.call('delete_project', { projectId: p2.id }, eq('ok', true))
  await m.call('delete_product', { productId: product.id }, eq('ok', true))
  await m.call('list_products', {}, (v) =>
    assert(!v.items.some((x) => x.id === product.id)),
  )

  await viewer.call(
    'change_password',
    {
      body: {
        currentPassword: 'Reset-Viewer-Test42!',
        newPassword: 'Changed-Viewer-Test42!',
      },
    },
    (v) => {
      assert.equal(v.ok, true)
      assert(!v.token)
    },
  )
  await viewer.call('whoami', {}, undefined, 401)
  viewerJwt = await login('mcp-owned-viewer', 'Changed-Viewer-Test42!')
  assert(viewerJwt)
  await m.call('delete_user', { userId: user.id }, eq('ok', true))
  await m.call('get_user', { userId: user.id }, undefined, 404)
  const nextAdmin = (
    await m.call(
      'create_user',
      {
        body: {
          name: 'Owned next admin',
          username: 'mcp-next-admin',
          email: 'next@mcp-e2e.test',
          password: 'Next-Admin-Test42!',
          role: 'viewer',
        },
      },
      (v) => assert(v.user.id),
    )
  ).user
  await m.call(
    'transfer_admin',
    { body: { targetUserId: nextAdmin.id, nextRole: 'viewer' } },
    (v) => {
      assert.equal(v.target.role, 'admin')
      assert.equal(v.user.role, 'viewer')
    },
  )
  await m.call('whoami', {}, undefined, 401)
  const nextJwt = await login('mcp-next-admin', 'Next-Admin-Test42!')
  assert.equal((await http('/auth/me', nextJwt)).value.user.role, 'admin')
} catch (error) {
  console.error(error.name + ': ' + error.message)
  if (!results.some((r) => r.verdict.endsWith('fail')))
    results.push({ verdict: 'test-fail', message: error.message })
  process.exitCode = 1
} finally {
  sessions.forEach((s) => s.stop())
  if (directory) {
    assert(directory.startsWith(out + sep))
    await rm(directory, { recursive: true, force: true })
  }
  const missing = discovered.filter((name) => !passedTools.has(name))
  const report = {
    started,
    ended: new Date().toISOString(),
    environment:
      'isolated deployed-image PostgreSQL16 / local storage / simulated Jenkins',
    productionBusinessWrites: false,
    discovered: discovered.length,
    passedTools: passedTools.size,
    missing,
    results,
  }
  await writeFile(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(
    JSON.stringify({
      discovered: report.discovered,
      passedTools: report.passedTools,
      missing,
      failures: results.filter((r) => r.verdict.endsWith('fail')),
    }),
  )
  if (missing.length) process.exitCode = 1
}
