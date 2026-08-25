import test from 'node:test'
import assert from 'node:assert/strict'
import { ArtifactCenterClient, ArtifactCenterError, releaseCredentialClient } from '../src/client.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

test('adds the bearer token, preserves an API base path, and returns JSON', async () => {
  let request
  const client = new ArtifactCenterClient({ baseUrl: 'https://artifact.example/api', token: 'acrt_test', fetchImpl: async (url, init) => { request = { url, init }; return jsonResponse({ items: [] }) } })
  assert.deepEqual(await client.get('/applications'), { items: [] })
  assert.equal(request.url.toString(), 'https://artifact.example/api/applications')
  assert.equal(request.init.headers.get('authorization'), 'Bearer acrt_test')
})

test('normalizes API errors', async () => {
  const client = new ArtifactCenterClient({ baseUrl: 'https://artifact.example', fetchImpl: async () => jsonResponse({ error: { code: 'forbidden', message: 'No access' } }, 403) })
  await assert.rejects(client.get('/applications'), (error) => error instanceof ArtifactCenterError && error.status === 403 && error.code === 'forbidden')
})

test('uploads local file chunks and completes the session', async () => {
  const calls = []
  const client = new ArtifactCenterClient({ baseUrl: 'https://artifact.example', token: 'acrt_test', fetchImpl: async (url, init) => {
    calls.push({ path: url.pathname, method: init.method || 'GET', body: init.body })
    if (url.pathname.endsWith('/uploads')) return jsonResponse({ upload: { uploadId: 'u1', partSize: 2, partCount: 2, uploadedParts: [], transport: 'proxy' } }, 201)
    if (url.pathname.endsWith('/parts/1') || url.pathname.endsWith('/parts/2')) return jsonResponse({ part: { number: 1, sizeBytes: 2 } }, 201)
    if (url.pathname.endsWith('/complete')) return jsonResponse({ artifact: { id: 'a1' } }, 201)
    throw new Error(`Unexpected ${url.pathname}`)
  } })
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path')
  const directory = await mkdtemp(join(tmpdir(), 'artifact-mcp-')); const file = join(directory, 'app.apk'); await writeFile(file, 'apk')
  try { assert.deepEqual(await client.uploadArtifact({ applicationId: 'app', filePath: file, version: '1.0.0', buildNumber: '1', platform: 'android' }), { artifact: { id: 'a1' } }) } finally { await rm(directory, { recursive: true, force: true }) }
  assert.deepEqual(calls.map(({ path, method }) => `${method} ${path}`), ['POST /applications/app/uploads', 'PUT /uploads/u1/parts/1', 'PUT /uploads/u1/parts/2', 'POST /uploads/u1/complete'])
  assert.equal(JSON.parse(calls[0].body).markLatest, false)
  assert.deepEqual(calls.slice(1, 3).map(({ body }) => [...body]), [[97, 112], [107]])
})

test('requires a release credential rather than a user JWT', () => {
  assert.throws(() => releaseCredentialClient({ ARTIFACT_CENTER_URL: 'https://artifact.example' }), ArtifactCenterError)
  assert.throws(() => releaseCredentialClient({ ARTIFACT_CENTER_URL: 'https://artifact.example', ARTIFACT_CENTER_TOKEN: 'ey-user-jwt' }), /Release Credential/)
  const client = releaseCredentialClient({ ARTIFACT_CENTER_URL: 'https://artifact.example', ARTIFACT_CENTER_TOKEN: 'acrt_test' })
  assert.equal(client.token, 'acrt_test')
})
