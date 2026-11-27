import assert from 'node:assert/strict'
import test from 'node:test'
import { ArtifactCenterClient, releaseCredentialClient } from '../src/client.js'
import { registerManagementTools, managementOperations } from '../src/management.js'

function toolsFor(token, fetchImpl) {
  const handlers = new Map()
  const client = new ArtifactCenterClient({
    token,
    baseUrl: 'https://artifact.example/api',
    fetchImpl,
  })
  registerManagementTools(
    {
      registerTool(name, spec, handler) {
        handlers.set(name, { spec, handler })
      },
    },
    () => client,
    (fn) => fn,
  )
  return handlers
}
test('all management tools use account-bound credentials and never upgrade publishing credentials', async () => {
  let requests = 0
  const handlers = toolsFor('acrt_test', async () => {
    requests++
    throw new Error('must not fetch')
  })
  for (const { handler } of handlers.values())
    await assert.rejects(handler({}), /account-bound/)
  assert.equal(requests, 0)
  assert.equal(handlers.size, managementOperations.length)
  assert.equal(
    new Set(managementOperations.map(([name]) => name)).size,
    managementOperations.length,
  )
  assert.equal(
    releaseCredentialClient({ ARTIFACT_CENTER_TOKEN: 'acmt_test' }).token,
    'acmt_test',
  )
})
test('management requests preserve API base, encode IDs, serialize query/body and propagate permission errors', async () => {
  const calls = []
  const handlers = toolsFor('acmt_test', async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(
      JSON.stringify(
        url.pathname.endsWith('/users')
          ? { error: { code: 'forbidden', message: 'Admin required' } }
          : { ok: true },
      ),
      {
        status: url.pathname.endsWith('/users') ? 403 : 200,
        headers: { 'content-type': 'application/json' },
      },
    )
  })
  await handlers
    .get('artifact_center_list_artifacts')
    .handler({ applicationId: 'a/b', query: { limit: 30, cursor: 'x+y' } })
  assert.equal(
    calls[0].url,
    'https://artifact.example/api/applications/a%2Fb/artifacts?limit=30&cursor=x%2By',
  )
  assert.equal(calls[0].init.headers.get('authorization'), 'Bearer acmt_test')
  await handlers
    .get('artifact_center_manage_artifact')
    .handler({ artifactId: 'artifact', body: { markLatest: true } })
  assert.equal(calls[1].init.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[1].init.body), { markLatest: true })
  await assert.rejects(
    handlers.get('artifact_center_list_users').handler({}),
    (error) => error.status === 403 && error.code === 'forbidden',
  )
  await assert.rejects(
    handlers.get('artifact_center_delete_user').handler({ userId: '..' }),
    /Invalid userId/,
  )
})
