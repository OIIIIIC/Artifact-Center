import assert from 'node:assert/strict'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import test from 'node:test'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const bundle = resolve('dist/artifact-center-mcp.mjs')

test('the distributed client runs without repository source or node_modules', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'artifact-center-mcp-distribution-'))
  const isolatedBundle = join(directory, basename(bundle))
  await copyFile(bundle, isolatedBundle)

  const client = new Client({ name: 'distribution-test', version: '1.0.0' })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [isolatedBundle],
    env: {
      ...process.env,
      ARTIFACT_CENTER_URL: 'https://artifact-center.example',
      ARTIFACT_CENTER_TOKEN: 'acrt_distribution_test_token_that_is_long_enough',
    },
  })

  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    assert.deepEqual(
      tools.map((tool) => tool.name),
      [
        'artifact_center_check_authorization',
        'artifact_center_list_applications',
        'artifact_center_get_application',
        'artifact_center_upload_artifact',
        'artifact_center_update_artifact',
      ],
    )
  } finally {
    await client.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('the distribution publishes a SHA-256 checksum', async () => {
  const checksum = (await readFile(resolve('dist/artifact-center-mcp.sha256'), 'utf8')).trim()
  assert.match(checksum, /^[a-f0-9]{64}$/)
})
