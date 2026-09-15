import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareUpload, confirmUpload, matchRepository } from '../src/publishing.js'

const exec = promisify(execFile)
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'ac-publish-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const git = (...args) => exec('git', ['-C', directory, ...args], { windowsHide: true })
  await git('init', '-b', 'main')
  await git('remote', 'add', 'origin', 'https://git.example/team/app.git')
  await git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--allow-empty',
    '-m',
    'init',
  )
  await writeFile(join(directory, 'app.apk'), 'apk')
  const target = {
    applicationId: 'app1',
    applicationName: 'App',
    platform: 'android',
    region: { code: 'cn' },
  }
  let uploaded
  let candidates = [{ id: 'app1' }]
  let verifiedHash
  const client = {
    baseUrl: 'https://artifacts.example/api',
    token: 'acrt_test',
    async get(path) {
      if (path.startsWith('/release/applications?')) return { items: candidates }
      if (path.endsWith('/target')) return { target }
      if (path.endsWith('/verify'))
        return {
          available: true,
          artifact: { ...uploaded, sizeBytes: 3, sha256: verifiedHash },
          target,
          pagePath: '/applications/app1',
        }
      throw new Error(path)
    },
    async uploadArtifact(input) {
      assert.equal(await readFile(input.filePath, 'utf8'), 'apk')
      uploaded = input
      return { artifact: { id: 'artifact1' } }
    },
  }
  const input = {
    directory,
    filePath: 'app.apk',
    platform: 'android',
    version: '1.0',
    buildNumber: '1',
    channel: 'beta',
    releaseNotes: '测试',
  }
  return {
    directory,
    git,
    client,
    input,
    target,
    uploaded: () => uploaded,
    candidates: (value) => {
      candidates = value
    },
    hash: (value) => {
      verifiedHash = value
    },
  }
}

test('preview performs no upload; confirmation uploads reviewed bytes and verifies them; cannot replay', async (t) => {
  const f = await fixture(t)
  const preview = await prepareUpload(f.client, f.input)
  f.hash(preview.sha256)
  assert.equal(f.uploaded(), undefined)
  assert.equal(preview.markLatest, false)
  await assert.rejects(
    confirmUpload(f.client, { planId: preview.planId, confirmed: false }),
    /confirmation/,
  )
  const result = await confirmUpload(f.client, {
    planId: preview.planId,
    confirmed: true,
  })
  assert.equal(result.available, true)
  await assert.rejects(
    confirmUpload(f.client, { planId: preview.planId, confirmed: true }),
    /confirmation/,
  )
})

test('changed artifact blocks upload until a new preview', async (t) => {
  const f = await fixture(t)
  const preview = await prepareUpload(f.client, f.input)
  await writeFile(join(f.directory, 'app.apk'), 'new')
  await assert.rejects(
    confirmUpload(f.client, { planId: preview.planId, confirmed: true }),
    /Artifact changed/,
  )
  assert.equal(f.uploaded(), undefined)
})

test('ambiguous and missing repository bindings never choose a target', async (t) => {
  const f = await fixture(t)
  f.candidates([{ id: 'app1' }, { id: 'app2' }])
  assert.equal((await matchRepository(f.client, f.input)).selectionRequired, true)
  await assert.rejects(prepareUpload(f.client, f.input), /Select one exact/)
  f.candidates([])
  await assert.rejects(prepareUpload(f.client, f.input), /Select one exact/)
})

test('binding changes and verification mismatches are failures', async (t) => {
  const f = await fixture(t)
  const preview = await prepareUpload(f.client, f.input)
  f.target.region.code = 'other'
  // Mock responses normally serialize; replace the region to avoid sharing preview references.
  f.candidates([])
  await assert.rejects(
    confirmUpload(f.client, { planId: preview.planId, confirmed: true }),
    /target changed/,
  )
  assert.equal(f.uploaded(), undefined)
  f.candidates([{ id: 'app1' }])
  const next = await prepareUpload(f.client, f.input)
  f.hash('incorrect')
  await assert.rejects(
    confirmUpload(f.client, { planId: next.planId, confirmed: true }),
    /failed file/,
  )
  await assert.rejects(
    confirmUpload(f.client, { planId: next.planId, confirmed: true }),
    /confirmation/,
  )
})

test('detached HEAD cannot be matched for publishing', async (t) => {
  const f = await fixture(t)
  await f.git('checkout', '--detach')
  await assert.rejects(matchRepository(f.client, f.input), /Detached HEAD/)
})

test('a second edit to an already dirty tracked file invalidates the preview', async (t) => {
  const f = await fixture(t)
  await writeFile(join(f.directory, 'source.txt'), 'original')
  await f.git('add', 'source.txt')
  await f.git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '-m',
    'source',
  )
  await writeFile(join(f.directory, 'source.txt'), 'first edit')
  const preview = await prepareUpload(f.client, f.input)
  await writeFile(join(f.directory, 'source.txt'), 'second edit')
  await assert.rejects(
    confirmUpload(f.client, { planId: preview.planId, confirmed: true }),
    /Repository or target changed/,
  )
  assert.equal(f.uploaded(), undefined)
})
