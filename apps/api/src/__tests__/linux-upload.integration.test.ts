import type { PGlite } from '@electric-sql/pglite'
import { Hono } from 'hono'
import { createHash } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ client: null as unknown as PGlite, storage: '' }))
vi.mock('../db/client.js', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm')
  fixture.client = new PGlite({ extensions: { pg_trgm } })
  return { db: drizzle(fixture.client) }
})
vi.mock('../env.js', async (original) => {
  const actual = await original<typeof import('../env.js')>()
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  fixture.storage = mkdtempSync(join(tmpdir(), 'artifact-linux-test-'))
  return {
    env: {
      ...actual.env,
      storagePath: fixture.storage,
      objectStorage: null,
      storageMinFreeBytes: 1,
    },
  }
})

import { signAccessToken } from '../lib/jwt.js'
import { uploadRoutes } from '../routes/uploads.js'
import { artifactRoutes } from '../routes/artifacts.js'
import { applicationRoutes } from '../routes/applications.js'
import { workspaceRoutes } from '../routes/workspace.js'
import { resolveArtifactType } from '../lib/artifact-types.js'

const app = new Hono()
  .route('/', uploadRoutes)
  .route('/', artifactRoutes)
  .route('/applications', applicationRoutes)
  .route('/workspace', workspaceRoutes)
const ids = {
  user: '00000000-0000-4000-8000-000000000001',
  region: '00000000-0000-4000-8000-000000000002',
  app: '00000000-0000-4000-8000-000000000003',
  release: '00000000-0000-4000-8000-000000000004',
}
type ArtifactResponse = {
  artifact: {
    id: string
    platform: string
    type: string
    originalFilename: string
    filename: string
    sha256: string
  }
}
let token: string
const request = (url: string, method = 'GET', body?: unknown) =>
  app.request(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

beforeAll(async () => {
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as { entries: { idx: number; tag: string }[] }
  for (const entry of journal.entries) {
    if (entry.idx === 26) {
      await fixture.client.exec(`
        INSERT INTO users (id,username,email,name,password_hash,role) VALUES ('${ids.user}','linux-test','linux@test.local','Linux test','test','admin');
        INSERT INTO regions (id,code,name) VALUES ('${ids.region}','linux-test','Linux test');
        INSERT INTO applications (id,name,application_code,package_name,platform,region_id,project_id) SELECT '${ids.app}','Linux agent','linux-agent','agent','zip','${ids.region}',id FROM projects WHERE product_id='${ids.region}';
        INSERT INTO user_workspace_preferences (user_id,platform) VALUES ('${ids.user}','zip');
        INSERT INTO releases (id,application_id,version) VALUES ('${ids.release}','${ids.app}','0.0.1');
        INSERT INTO artifacts (application_id,release_id,version,platform,type,original_filename,filename,storage_key) VALUES ('${ids.app}','${ids.release}','0.0.1','zip','zip','legacy.zip','legacy.zip','untouched/legacy.zip');
      `)
    }
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  }
  token = await signAccessToken({
    sub: ids.user,
    role: 'admin',
    name: 'Linux test',
    email: 'linux@test.local',
    tokenVersion: 0,
  })
}, 30000)

afterAll(async () => {
  await fixture.client?.close()
  // Only remove the exact temporary directory created by this test.
  if (
    path.dirname(fixture.storage) !== path.resolve(os.tmpdir()) ||
    !path.basename(fixture.storage).startsWith('artifact-linux-test-')
  )
    throw new Error('Unexpected test storage path')
  await rm(fixture.storage, { recursive: true, force: true })
})

it('migrates old platform values without changing artifact type or storage paths', async () => {
  expect((await fixture.client.query('SELECT platform FROM applications')).rows).toEqual([
    { platform: 'linux' },
  ])
  expect(
    (await fixture.client.query('SELECT platform FROM user_workspace_preferences')).rows,
  ).toEqual([{ platform: 'linux' }])
  expect(
    (
      await fixture.client.query(
        'SELECT platform,type,filename,storage_key FROM artifacts',
      )
    ).rows,
  ).toEqual([
    {
      platform: 'linux',
      type: 'zip',
      filename: 'legacy.zip',
      storage_key: 'untouched/legacy.zip',
    },
  ])
  const legacyFilter = await request('/applications?platform=zip')
  const modernFilter = await request('/applications?platform=linux')
  expect(await legacyFilter.json()).toEqual(await modernFilter.json())
})

it.each(['zip', 'tar', 'tar.gz', 'tgz', 'deb', 'rpm', 'AppImage'])(
  'publishes and downloads Linux .%s with exact bytes and filename',
  async (extension) => {
    const bytes = Buffer.from(`Linux test package ${extension}\n`)
    const filename = `agent.${extension}`
    const start = await request(`/applications/${ids.app}/uploads`, 'POST', {
      filename,
      resumeKey: `linux-fixture-${extension}`,
      sizeBytes: bytes.length,
      version: '1.0.0',
      buildNumber: extension,
      platform: extension === 'zip' ? 'zip' : 'linux',
      channel: 'beta',
      markLatest: false,
    })
    expect(start.status, await start.clone().text()).toBe(201)
    const { upload } = (await start.json()) as { upload: { uploadId: string } }
    const part = await app.request(`/uploads/${upload.uploadId}/parts/1`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Length': String(bytes.length),
      },
      body: bytes,
    })
    expect(part.status, await part.clone().text()).toBe(201)
    const completion = await request(`/uploads/${upload.uploadId}/complete`, 'POST', {})
    expect(completion.status, await completion.clone().text()).toBe(201)
    const { artifact } = (await completion.json()) as ArtifactResponse
    expect(artifact.platform).toBe('linux')
    expect(artifact.type).toBe(resolveArtifactType(filename))
    expect(artifact.originalFilename).toBe(filename)
    expect(artifact.filename.endsWith(`.${extension.toLowerCase()}`)).toBe(true)
    expect(artifact.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    const download = await request(`/artifacts/${artifact.id}/download`)
    expect(download.status).toBe(200)
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes)
    expect(download.headers.get('content-disposition')).toContain(artifact.filename)
  },
)

it.each(['agent.apk', 'agent.aab', 'agent.exe', 'agent.msi'])(
  'rejects %s for Linux before creating an upload session',
  async (filename) => {
    const response = await request(`/applications/${ids.app}/uploads`, 'POST', {
      filename,
      resumeKey: 'linux-wrong-platform',
      sizeBytes: 4,
      version: '2.0.0',
      platform: 'linux',
    })
    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'platform_mismatch',
    )
  },
)

it('keeps the legacy multipart upload endpoint consistent with resumable uploads', async () => {
  const bytes = Buffer.from('Linux multipart test')
  const form = new FormData()
  form.append('file', new Blob([bytes]), 'agent.tar.gz')
  form.append('version', '3.0.0')
  form.append('buildNumber', '1')
  form.append('platform', 'linux')
  const response = await app.request(`/applications/${ids.app}/artifacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  expect(response.status, await response.clone().text()).toBe(201)
  const { artifact } = (await response.json()) as ArtifactResponse
  expect(artifact.type).toBe('tar.gz')
  expect(artifact.filename).toMatch(/\.tar\.gz$/)
  expect(
    Buffer.from(
      await (await request(`/artifacts/${artifact.id}/download`)).arrayBuffer(),
    ),
  ).toEqual(bytes)
})

it.each(['linux', 'zip'])(
  'creates applications from platform %s as canonical Linux',
  async (platform) => {
    const response = await request('/applications', 'POST', {
      name: 'Linux create ' + platform,
      applicationCode: 'linux-test',
      description: 'Linux integration fixture',
      packageName: 'linux.agent',
      platform,
      regionId: ids.region,
    })
    expect(response.status, await response.clone().text()).toBe(201)
    const data = (await response.json()) as { application: { platform: string } }
    expect(data.application.platform).toBe('linux')
  },
)
