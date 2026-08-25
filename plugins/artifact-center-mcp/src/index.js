import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ArtifactCenterError, releaseCredentialClient } from './client.js'

const server = new McpServer({ name: 'artifact-center', version: '0.1.0' })
const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value })
const fail = (error) => ({ content: [{ type: 'text', text: error instanceof ArtifactCenterError ? `${error.message}${error.code ? ` (${error.code})` : ''}` : `Unexpected error: ${error.message}` }], isError: true })
const run = (handler) => async (input) => { try { return text(await handler(input)) } catch (error) { return fail(error) } }
const client = () => releaseCredentialClient()

server.registerTool('artifact_center_check_authorization', {
  description: 'Check that ARTIFACT_CENTER_TOKEN is a usable release credential and list the applications it may publish to.',
  inputSchema: {},
}, run(async () => (await client()).get('/release/applications')))

server.registerTool('artifact_center_list_applications', {
  description: 'List non-archived Artifact Center applications that this release credential may publish to.',
  inputSchema: { query: z.string().optional(), platform: z.enum(['android', 'windows', 'zip']).optional() },
}, run(async ({ query, platform }) => {
  const params = new URLSearchParams()
  if (query) params.set('q', query); if (platform) params.set('platform', platform)
  return (await client()).get(`/release/applications?${params}`)
}))

server.registerTool('artifact_center_get_application', {
  description: 'Get and verify one exact publish target available to this release credential.',
  inputSchema: { applicationId: z.string().min(1) },
}, run(async ({ applicationId }) => (await client()).get(`/release/applications/${encodeURIComponent(applicationId)}/target`)))

server.registerTool('artifact_center_upload_artifact', {
  description: 'Upload a completed APK, AAB, EXE/MSI, or ZIP as beta or stable without replacing latest. Upload is resumable and requires an explicit build number.',
  inputSchema: {
    applicationId: z.string().min(1), filePath: z.string().min(1), version: z.string().min(1), buildNumber: z.string().min(1),
    platform: z.enum(['android', 'windows', 'zip']), channel: z.enum(['beta', 'stable']).default('beta'),
    releaseNotes: z.string().max(8000).default(''),
  },
}, run(async (input) => (await client()).uploadArtifact(input)))

server.registerTool('artifact_center_update_artifact', {
  description: 'Update release notes or explicitly promote one beta artifact to stable. There is intentionally no delete tool; deletion must be performed manually in Artifact Center.',
  inputSchema: {
    artifactId: z.string().min(1), releaseNotes: z.string().max(8000).optional(),
    promoteToStable: z.literal(true).optional(), confirmStablePromotion: z.literal(true).optional(),
  },
}, run(async ({ artifactId, ...changes }) => {
  const present = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
  if (!Object.keys(present).length) throw new ArtifactCenterError('Provide at least one field to update')
  return (await client()).patch(`/release/artifacts/${encodeURIComponent(artifactId)}`, present)
}))

await server.connect(new StdioServerTransport())
