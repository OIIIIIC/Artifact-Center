import {
  matchRepository,
  readBuildRecipe,
  prepareUpload,
  confirmUpload,
} from './publishing.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ArtifactCenterError, releaseCredentialClient } from './client.js'

const server = new McpServer({ name: 'artifact-center', version: '0.1.0' })
const text = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
})
const fail = (error) => ({
  content: [
    {
      type: 'text',
      text:
        error instanceof ArtifactCenterError
          ? `${error.message}${error.code ? ` (${error.code})` : ''}`
          : `Unexpected error: ${error.message}`,
    },
  ],
  isError: true,
})
const run = (handler) => async (input) => {
  try {
    return text(await handler(input))
  } catch (error) {
    return fail(error)
  }
}
const client = () => releaseCredentialClient()

server.registerTool(
  'artifact_center_check_authorization',
  {
    description:
      'Check that ARTIFACT_CENTER_TOKEN is a usable release credential and list the applications it may publish to.',
    inputSchema: {},
  },
  run(async () => (await client()).get('/release/applications')),
)

server.registerTool(
  'artifact_center_list_applications',
  {
    description:
      'List non-archived Artifact Center applications that this release credential may publish to.',
    inputSchema: {
      query: z.string().optional(),
      platform: z
        .enum(['android', 'windows', 'linux', 'zip'])
        .transform((value) => (value === 'zip' ? 'linux' : value))
        .optional(),
    },
  },
  run(async ({ query, platform }) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (platform) params.set('platform', platform)
    return (await client()).get(`/release/applications?${params}`)
  }),
)

server.registerTool(
  'artifact_center_get_application',
  {
    description:
      'Get and verify one exact publish target available to this release credential.',
    inputSchema: { applicationId: z.string().min(1) },
  },
  run(async ({ applicationId }) =>
    (await client()).get(
      `/release/applications/${encodeURIComponent(applicationId)}/target`,
    ),
  ),
)

server.registerTool(
  'artifact_center_match_repository',
  {
    description:
      'Read local Git remote, branch and code directory and find exact permitted publishing targets. Never guess among multiple matches. Also returns the local declarative build recipe; the host must inspect and run checks/typecheck/build before preparing a preview. No commands from the recipe are executed by this tool.',
    inputSchema: { directory: z.string().min(1), remote: z.string().default('origin') },
  },
  run(async (input) => ({
    ...(await matchRepository(await client(), input)),
    buildRecipe: await readBuildRecipe(input.directory),
  })),
)

server.registerTool(
  'artifact_center_prepare_upload',
  {
    description:
      'After successful checks and build, snapshot the completed artifact and prepare a 30-minute publishing preview. Show the COMPLETE preview (application/product, branch/commit, file/size/SHA256, version/build, channel and release notes) to the user and WAIT for explicit confirmation before upload. No upload occurs here. Multiple matches require an explicit application selection. markLatest is always false.',
    inputSchema: {
      directory: z.string().min(1),
      remote: z.string().default('origin'),
      applicationId: z.string().optional(),
      filePath: z.string().min(1),
      version: z.string().trim().min(1).max(64),
      buildNumber: z.string().trim().min(1).max(64),
      platform: z.enum(['android', 'windows', 'linux']),
      channel: z.enum(['beta', 'stable']).default('beta'),
      releaseNotes: z.string().max(8000).default(''),
    },
  },
  run(async (input) => prepareUpload(await client(), input)),
)

server.registerTool(
  'artifact_center_upload_artifact',
  {
    description:
      'Upload only a previously prepared preview AFTER the user explicitly confirms that exact preview. Never infer confirmation from the initial publishing request. Uses the reviewed file snapshot and verifies the uploaded artifact. Changed target, Git context or file requires a fresh preview and confirmation. Does not select latest.',
    inputSchema: { planId: z.string().uuid(), confirmed: z.literal(true) },
  },
  run(async (input) => confirmUpload(await client(), input)),
)

server.registerTool(
  'artifact_center_update_artifact',
  {
    description:
      'Update release notes or explicitly promote one beta artifact to stable. There is intentionally no delete tool; deletion must be performed manually in Artifact Center.',
    inputSchema: {
      artifactId: z.string().min(1),
      releaseNotes: z.string().max(8000).optional(),
      promoteToStable: z.literal(true).optional(),
      confirmStablePromotion: z.literal(true).optional(),
    },
  },
  run(async ({ artifactId, ...changes }) => {
    const present = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    )
    if (!Object.keys(present).length)
      throw new ArtifactCenterError('Provide at least one field to update')
    return (await client()).patch(
      `/release/artifacts/${encodeURIComponent(artifactId)}`,
      present,
    )
  }),
)

await server.connect(new StdioServerTransport())
