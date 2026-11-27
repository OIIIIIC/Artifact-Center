import { z } from 'zod'
import { ArtifactCenterError } from './client.js'
import { managementBodies } from './management-inputs.js'

// Explicit operation catalog: no caller-controlled URL, method or authentication.
// Existing REST handlers remain the single source of authorization and validation.
export const managementOperations = [
  ['whoami', 'GET', '/auth/me', 'Get the bound account and current platform role.'],
  [
    'update_profile',
    'PATCH',
    '/auth/me',
    'Update own profile. body: name?, email?, avatarUrl? (null clears).',
  ],
  [
    'change_password',
    'POST',
    '/auth/change-password',
    'Change own password; invalidates existing credentials. body: currentPassword, newPassword.',
  ],
  ['list_users', 'GET', '/users', 'List platform accounts (admin).'],
  ['get_user', 'GET', '/users/:userId', 'Get an account (admin).'],
  [
    'create_user',
    'POST',
    '/users',
    'Create account (admin). body: name, username, email, password, role (admin|maintainer|viewer).',
  ],
  [
    'update_user',
    'PATCH',
    '/users/:userId',
    'Update account (admin). body: name?, role?, isActive?. Role/status changes revoke its credentials.',
  ],
  [
    'delete_user',
    'DELETE',
    '/users/:userId',
    'Delete account (admin); server protects the last administrator.',
  ],
  [
    'reset_user_password',
    'POST',
    '/users/:userId/reset-password',
    'Reset account password (admin). body: password.',
  ],
  [
    'transfer_admin',
    'POST',
    '/users/me/transfer-admin',
    'Transfer own administrator role. body: targetUserId, nextRole (maintainer|viewer).',
  ],
  [
    'list_products',
    'GET',
    '/settings/regions',
    'List products (legacy API name regions).',
  ],
  [
    'create_product',
    'POST',
    '/settings/regions',
    'Create product (admin). body: code, name, sortOrder?, enabled?.',
  ],
  [
    'update_product',
    'PATCH',
    '/settings/regions/:productId',
    'Update product (admin). body: code?, name?, sortOrder?, enabled?.',
  ],
  [
    'delete_product',
    'DELETE',
    '/settings/regions/:productId',
    'Delete product (admin), subject to server dependency checks.',
  ],
  ['list_projects', 'GET', '/settings/projects', 'List projects. query: productId?.'],
  [
    'create_project',
    'POST',
    '/settings/projects',
    'Create project (admin). body: productId, name, code?, sortOrder?, enabled?.',
  ],
  [
    'update_project',
    'PATCH',
    '/settings/projects/:projectId',
    'Update project (admin). body: name?, code?, sortOrder?, enabled?.',
  ],
  [
    'delete_project',
    'DELETE',
    '/settings/projects/:projectId',
    'Delete project (admin); default/nonempty projects are protected.',
  ],
  [
    'reorder_projects',
    'PUT',
    '/settings/projects/order',
    'Reorder projects (admin). body: productId, projectIds[], expectedOrder[].',
  ],
  [
    'browse_applications',
    'GET',
    '/applications',
    'Browse all accessible applications, including viewer access. query: limit?, cursor?, q?, platform?, status?, regionId?, projectId?.',
  ],
  [
    'application_summary',
    'GET',
    '/applications/summary',
    'Get permission-filtered application directory counts.',
  ],
  [
    'application_details',
    'GET',
    '/applications/:applicationId',
    'Get accessible application details.',
  ],
  [
    'application_overview',
    'GET',
    '/applications/:applicationId/overview',
    'Get application overview and latest artifacts.',
  ],
  [
    'create_application',
    'POST',
    '/applications',
    'Create application. body: name, packageName, platform (android|windows|linux), regionId, projectId?, applicationCode, description, repository?, repositoryBindings?.',
  ],
  [
    'edit_application',
    'PATCH',
    '/applications/:applicationId',
    'Edit application settings. body: name?, description?, status?, projectId?, regionId?, applicationCode?, repository?, repositoryBindings?, packageName?, platform?, ownerName?, iconKey?, iconColor?. Bindings: [{repository,branch,directory}].',
  ],
  [
    'delete_application',
    'DELETE',
    '/applications/:applicationId',
    'Delete application (admin) and associated resources.',
  ],
  [
    'bulk_application_codes',
    'PATCH',
    '/applications/bulk-codes',
    'Bulk update application codes (admin). body: updates:[{id,applicationCode}] (1–200).',
  ],
  [
    'bulk_application_appearance',
    'PATCH',
    '/applications/bulk-appearance',
    'Bulk update application appearance (admin). body: applicationIds[] (1–200), iconKey?, iconColor?.',
  ],
  [
    'list_application_members',
    'GET',
    '/applications/:applicationId/members',
    'List application membership.',
  ],
  [
    'member_candidates',
    'GET',
    '/applications/:applicationId/member-candidates',
    'Find candidate members. query: q?, limit?, cursor?.',
  ],
  [
    'set_application_member',
    'PUT',
    '/applications/:applicationId/members/:userId',
    'Assign application permission. body: role (maintainer|viewer).',
  ],
  [
    'remove_application_member',
    'DELETE',
    '/applications/:applicationId/members/:userId',
    'Remove application membership.',
  ],
  [
    'get_access_grants',
    'GET',
    '/settings/access-grants/:userId',
    'Get account application grants (admin).',
  ],
  [
    'set_access_grants',
    'POST',
    '/settings/access-grants',
    'Batch grant/remove application access (admin). body: operation (set|remove), userId, applicationIds[], role (required for set).',
  ],
  [
    'list_artifacts',
    'GET',
    '/applications/:applicationId/artifacts',
    'List application artifacts. query: limit?, cursor?, channel?, status?.',
  ],
  ['get_artifact', 'GET', '/artifacts/:artifactId', 'Get artifact metadata.'],
  [
    'manage_artifact',
    'PATCH',
    '/artifacts/:artifactId',
    'Update artifact, including latest selection. body: channel?, status?, markLatest?, releaseNotes?.',
  ],
  [
    'delete_artifact',
    'DELETE',
    '/artifacts/:artifactId',
    'Delete artifact and stored binary.',
  ],
  [
    'artifact_download_ticket',
    'POST',
    '/artifacts/:artifactId/download-ticket',
    'Create a short-lived download ticket; resolve returned path against the site API origin.',
  ],
  [
    'list_releases',
    'GET',
    '/applications/:applicationId/releases',
    'List release history. query: limit?, cursor?.',
  ],
  [
    'edit_release',
    'PATCH',
    '/applications/:applicationId/releases/:releaseId',
    'Edit release. body: releaseNotes (required).',
  ],
  [
    'list_shares',
    'GET',
    '/applications/:applicationId/shares',
    'List application shares without revealing existing share secrets.',
  ],
  [
    'create_share',
    'POST',
    '/applications/:applicationId/shares',
    'Create share. body: mode (latest|artifact), artifactId?, expiresInDays? (0 = no expiry). Returns new share token once.',
  ],
  [
    'create_share_collection',
    'POST',
    '/shares',
    'Create share collection. body: title, regionId, items:[{applicationId,mode,artifactId?}], expiresInDays?.',
  ],
  ['revoke_share', 'DELETE', '/shares/:shareId', 'Revoke share or collection.'],
  ['get_retention', 'GET', '/settings/retention', 'Read retention configuration.'],
  [
    'set_retention',
    'PATCH',
    '/settings/retention',
    'Update retention policy (admin). body: maxVersions?, archiveDeprecatedDays?, storageQuotaBytes?.',
  ],
  [
    'run_retention',
    'POST',
    '/settings/retention/run',
    'Run retention cleanup immediately (admin); may delete artifacts.',
  ],
  [
    'list_release_credentials',
    'GET',
    '/settings/release-credentials',
    'List release credentials (admin), without secret values.',
  ],
  [
    'create_release_credential',
    'POST',
    '/settings/release-credentials',
    'Create publishing-only credential (admin). body: name, expiresAt? (ISO datetime). Returns token once.',
  ],
  [
    'revoke_release_credential',
    'DELETE',
    '/settings/release-credentials/:credentialId',
    'Revoke publishing credential (admin).',
  ],
  [
    'list_mcp_credentials',
    'GET',
    '/account/mcp-credentials',
    'List own MCP credentials, without secret values.',
  ],
  [
    'revoke_mcp_credential',
    'DELETE',
    '/account/mcp-credentials/:credentialId',
    'Revoke own MCP credential. Create credentials in website settings.',
  ],
  [
    'list_audit',
    'GET',
    '/audit',
    'Query permission-filtered audit records. query: applicationId?, limit? (max 200), offset?.',
  ],
  [
    'search',
    'GET',
    '/search',
    'Search accessible applications/artifacts. query: q and existing search filters.',
  ],
  [
    'get_workspace',
    'GET',
    '/workspace',
    'Read own favorites, recent visits and workspace preferences.',
  ],
  [
    'set_favorite',
    'PUT',
    '/workspace/favorites/:applicationId',
    'Set favorite. body: favorite (boolean).',
  ],
  [
    'record_visit',
    'POST',
    '/workspace/visits/:applicationId',
    'Record own recent application visit.',
  ],
  [
    'set_workspace_preferences',
    'PUT',
    '/workspace/preferences',
    'Update own workspace preferences; body: platform?, sort?, regionId?, projectId?, query?, favoriteOnly?, responsibleOnly?, collapsed?.',
  ],
  [
    'get_jenkins',
    'GET',
    '/settings/jenkins',
    'Read Jenkins connection (admin); token stays masked.',
  ],
  [
    'set_jenkins',
    'PUT',
    '/settings/jenkins',
    'Configure Jenkins (admin). body: baseUrl, username, token?, enabled, revision.',
  ],
  [
    'test_jenkins',
    'POST',
    '/settings/jenkins/test',
    'Test Jenkins configuration (admin). body: baseUrl, username, token?, enabled, revision.',
  ],
  [
    'get_build_config',
    'GET',
    '/applications/:applicationId/build-config',
    'Read application build configuration.',
  ],
  [
    'set_build_config',
    'PUT',
    '/applications/:applicationId/build-config',
    'Update application Jenkins job binding (admin); body: enabled, jobPath, artifactPattern, parameters:[{name,value}], revision, outputTargets?:[{name,pattern,applicationId}].',
  ],
  [
    'test_build_config',
    'POST',
    '/applications/:applicationId/build-config/test',
    'Test application Jenkins job configuration (admin); body: enabled, jobPath, artifactPattern, parameters:[{name,value}], revision, outputTargets?:[{name,pattern,applicationId}].',
  ],
  [
    'list_builds',
    'GET',
    '/applications/:applicationId/builds',
    'List application build runs. query: limit?, cursor?.',
  ],
  [
    'start_build',
    'POST',
    '/applications/:applicationId/builds',
    'Start build. body: requestKey (new UUID for each new build; reuse for retry), configRevision (current config revision), parameters:[{name,value}], acknowledgeUnknown?.',
  ],
  [
    'get_build',
    'GET',
    '/applications/:applicationId/builds/:buildId',
    'Get build state and outputs.',
  ],
  [
    'cancel_build',
    'POST',
    '/applications/:applicationId/builds/:buildId/cancel',
    'Cancel queued or running build.',
  ],
  [
    'get_build_log',
    'GET',
    '/applications/:applicationId/builds/:buildId/log',
    'Read build log. query: start?.',
  ],
  [
    'build_download_ticket',
    'POST',
    '/applications/:applicationId/builds/:buildId/download-ticket',
    'Create short-lived build output download ticket. body: relativePath.',
  ],
  [
    'publish_build',
    'POST',
    '/applications/:applicationId/builds/:buildId/publications',
    'Publish selected successful build output; body: relativePath, version, channel? (beta|stable), releaseNotes?, confirmStable? (required true for stable).',
  ],
  [
    'get_upload',
    'GET',
    '/uploads/:uploadId',
    'Inspect an owned resumable upload session.',
  ],
  ['cancel_upload', 'DELETE', '/uploads/:uploadId', 'Cancel an owned upload session.'],
]

export function registerManagementTools(server, client, run) {
  for (const [name, method, path, description] of managementOperations) {
    const inputSchema = {}
    for (const match of path.matchAll(/:([A-Za-z]+)/g))
      inputSchema[match[1]] = z.string().min(1).describe(`Exact ${match[1]}`)
    if (method === 'GET')
      inputSchema.query = z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional()
    if (['POST', 'PATCH', 'PUT'].includes(method))
      inputSchema.body = managementBodies[name]
        ? managementBodies[name].describe(
            'JSON payload; permissions and domain validation are enforced by the server.',
          )
        : z.object({}).default({})
    server.registerTool(
      `artifact_center_${name}`,
      {
        description: `${description} Requires an account-bound MCP credential (acmt_). Server checks the current account and application permissions.`,
        inputSchema,
        annotations: {
          readOnlyHint: method === 'GET',
          destructiveHint: method !== 'GET',
          openWorldHint: false,
        },
      },
      run(async (input) => {
        const api = await client()
        if (!api.token?.startsWith('acmt_'))
          throw new ArtifactCenterError(
            'Management requires an account-bound MCP credential (acmt_). Create one in personal settings; publishing credentials cannot manage accounts or settings.',
          )
        let target = path.replace(/:([A-Za-z]+)/g, (_, key) => {
          if (!input[key] || input[key] === '.' || input[key] === '..')
            throw new ArtifactCenterError(`Invalid ${key}`)
          return encodeURIComponent(input[key])
        })
        const query = new URLSearchParams()
        if (['browse_applications', 'list_artifacts', 'list_releases'].includes(name))
          query.set('limit', '30')
        for (const [key, value] of Object.entries(input.query || {}))
          query.set(key, String(value))
        if (query.size) target += `?${query}`
        return api.request(target, {
          method,
          ...(['POST', 'PATCH', 'PUT'].includes(method)
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input.body || {}),
              }
            : {}),
        })
      }),
    )
  }
}
