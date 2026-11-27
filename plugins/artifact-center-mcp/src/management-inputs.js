import { z } from 'zod'

// Discoverable input shapes improve tool use; REST validation remains authoritative.
const id = z.string().uuid()
const text = z.string()
const role = z.enum(['admin', 'maintainer', 'viewer'])
const memberRole = z.enum(['maintainer', 'viewer'])
const platform = z.enum(['android', 'windows', 'linux'])
const product = z.object({
  code: text,
  name: text,
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
})
const project = z.object({
  name: text,
  code: text.nullable().optional(),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
})
const application = z.object({
  name: text,
  applicationCode: text,
  description: text,
  packageName: text,
  platform,
  regionId: id,
  projectId: id.optional(),
  repository: text.optional(),
  repositoryBindings: z
    .array(z.object({ repository: text, branch: text, directory: text }))
    .optional(),
})
const parameters = z.array(z.object({ name: text, value: text }))
const connection = z.object({
  baseUrl: text,
  username: text,
  token: text.optional(),
  enabled: z.boolean(),
  revision: z.number().int(),
})
const buildConfig = z.object({
  connectionId: text.optional(),
  enabled: z.boolean(),
  jobPath: text,
  artifactPattern: text,
  parameters,
  revision: z.number().int(),
  outputTargets: z
    .array(z.object({ name: text, pattern: text, applicationId: id }))
    .optional(),
})
const share = z.object({
  mode: z.enum(['latest', 'artifact']).optional(),
  artifactId: id.optional(),
  expiresInDays: z.number().int().min(0).max(365).optional(),
})

export const managementBodies = {
  update_profile: z.object({
    name: text.optional(),
    email: text.optional(),
    avatarUrl: text.nullable().optional(),
  }),
  change_password: z.object({ currentPassword: text, newPassword: text }),
  create_user: z.object({
    name: text,
    username: text,
    email: text,
    password: text,
    role: role.optional(),
  }),
  update_user: z.object({
    name: text.optional(),
    role: role.optional(),
    isActive: z.boolean().optional(),
  }),
  reset_user_password: z.object({ password: text }),
  transfer_admin: z.object({ targetUserId: id, nextRole: memberRole.optional() }),
  create_product: product,
  update_product: product.partial(),
  create_project: project.extend({ productId: id }),
  update_project: project.partial(),
  reorder_projects: z.object({
    productId: id,
    projectIds: z.array(id),
    expectedOrder: z.array(id),
  }),
  create_application: application,
  edit_application: application.partial().extend({
    status: z.enum(['active', 'new', 'beta', 'deprecated', 'archived']).optional(),
    ownerName: text.optional(),
    iconKey: text.optional(),
    iconColor: text.optional(),
  }),
  bulk_application_codes: z.object({
    updates: z.array(z.object({ id, applicationCode: text })),
  }),
  bulk_application_appearance: z.object({
    applicationIds: z.array(id),
    iconKey: text.optional(),
    iconColor: text.optional(),
  }),
  set_application_member: z.object({ role: memberRole }),
  set_access_grants: z.discriminatedUnion('operation', [
    z.object({
      operation: z.literal('set'),
      userId: id,
      applicationIds: z.array(id),
      role: memberRole,
    }),
    z.object({ operation: z.literal('remove'), userId: id, applicationIds: z.array(id) }),
  ]),
  manage_artifact: z.object({
    channel: z.enum(['stable', 'beta', 'internal', 'deprecated']).optional(),
    status: z.enum(['latest', 'stable', 'beta', 'deprecated', 'archived']).optional(),
    markLatest: z.boolean().optional(),
    releaseNotes: text.optional(),
  }),
  edit_release: z.object({ releaseNotes: text }),
  create_share: share,
  create_share_collection: z.object({
    title: text,
    regionId: id,
    items: z.array(
      z.object({
        applicationId: id,
        mode: z.enum(['latest', 'artifact']).optional(),
        artifactId: id.optional(),
      }),
    ),
    expiresInDays: z.number().int().min(0).max(365).optional(),
  }),
  set_retention: z.object({
    maxVersions: z.number().int().optional(),
    archiveDeprecatedDays: z.number().int().optional(),
    storageQuotaBytes: z.number().int().optional(),
  }),
  create_release_credential: z.object({ name: text, expiresAt: text.optional() }),
  set_favorite: z.object({ favorite: z.boolean(), restoreOrder: z.boolean().optional() }),
  set_workspace_preferences: z.object({
    platform: z.enum(['all', 'android', 'windows', 'linux']).optional(),
    sort: z.enum(['updated', 'name', 'created']).optional(),
    regionId: id.nullable().optional(),
    projectId: id.nullable().optional(),
    query: text.optional(),
    favoriteOnly: z.boolean().optional(),
    responsibleOnly: z.boolean().optional(),
    collapsed: z.boolean().optional(),
  }),
  set_jenkins: connection,
  test_jenkins: connection,
  set_build_config: buildConfig,
  test_build_config: buildConfig,
  start_build: z.object({
    requestKey: id,
    configRevision: z.number().int(),
    parameters,
    acknowledgeUnknown: z.boolean().optional(),
  }),
  build_download_ticket: z.object({ relativePath: text }),
  publish_build: z.object({
    relativePath: text,
    version: text,
    channel: z.enum(['beta', 'stable']).optional(),
    releaseNotes: text.optional(),
    confirmStable: z.boolean().optional(),
  }),
}
