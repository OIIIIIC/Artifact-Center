import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'maintainer', 'viewer'])

export const appPlatformEnum = pgEnum('app_platform', ['android', 'windows', 'zip'])

export const appStatusEnum = pgEnum('app_status', [
  'active',
  'new',
  'beta',
  'deprecated',
  'archived',
])

export const artifactStatusEnum = pgEnum('artifact_status', [
  'latest',
  'stable',
  'beta',
  'deprecated',
  'archived',
])

export const channelEnum = pgEnum('release_channel', [
  'stable',
  'beta',
  'internal',
  'deprecated',
])

export const shareModeEnum = pgEnum('share_mode', ['latest', 'artifact'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('maintainer'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    packageName: varchar('package_name', { length: 255 }).notNull(),
    platform: appPlatformEnum('platform').notNull(),
    repository: varchar('repository', { length: 500 }).notNull().default(''),
    status: appStatusEnum('status').notNull().default('new'),
    ownerId: uuid('owner_id').references(() => users.id),
    ownerName: varchar('owner_name', { length: 120 }).notNull().default(''),
    latestVersion: varchar('latest_version', { length: 64 }).notNull().default(''),
    artifactCount: integer('artifact_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('applications_package_name_uidx').on(t.packageName)],
)

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 64 }).notNull(),
    buildNumber: varchar('build_number', { length: 64 }).notNull().default(''),
    platform: appPlatformEnum('platform').notNull(),
    channel: channelEnum('channel').notNull().default('stable'),
    status: artifactStatusEnum('status').notNull().default('stable'),
    filename: varchar('filename', { length: 500 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    sha256: varchar('sha256', { length: 64 }),
    storageKey: text('storage_key').notNull(),
    releaseNotes: text('release_notes').notNull().default(''),
    uploaderId: uuid('uploader_id').references(() => users.id),
    uploaderName: varchar('uploader_name', { length: 120 }).notNull().default(''),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    /** When status/channel became deprecated (for retention archive) */
    deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('artifacts_app_version_uidx').on(t.applicationId, t.version)],
)

/**
 * Singleton-ish retention policy (id always "default").
 */
export const retentionSettings = pgTable('retention_settings', {
  id: varchar('id', { length: 32 }).primaryKey().default('default'),
  /** Keep at most N versions per application (latest preferred). */
  maxVersions: integer('max_versions').notNull().default(20),
  /** Soft-archive deprecated artifacts after this many days. */
  archiveDeprecatedDays: integer('archive_deprecated_days').notNull().default(90),
  /** Soft storage quota for display / future hard limits. */
  storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'number' })
    .notNull()
    .default(1_099_511_627_776), // 1 TiB
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Server-issued capability links for internal distribution.
 * Token is opaque; resolution always hits the API.
 */
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    token: varchar('token', { length: 64 }).notNull().unique(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    mode: shareModeEnum('mode').notNull().default('latest'),
    artifactId: uuid('artifact_id').references(() => artifacts.id, {
      onDelete: 'set null',
    }),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdByName: varchar('created_by_name', { length: 120 }).notNull().default(''),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    downloadCount: integer('download_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('share_links_application_id_idx').on(t.applicationId),
    index('share_links_token_idx').on(t.token),
  ],
)

/**
 * Append-only operation log for audit / activity timeline.
 * Ordinary users must not update or delete these rows (enforced in API).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actorName: varchar('actor_name', { length: 120 }).notNull().default(''),
    action: varchar('action', { length: 64 }).notNull(),
    objectType: varchar('object_type', { length: 32 }).notNull(),
    objectId: varchar('object_id', { length: 64 }),
    applicationId: uuid('application_id').references(() => applications.id, {
      onDelete: 'set null',
    }),
    summary: text('summary').notNull().default(''),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_application_id_idx').on(t.applicationId),
    index('audit_logs_action_idx').on(t.action),
  ],
)

export type User = typeof users.$inferSelect
export type Application = typeof applications.$inferSelect
export type Artifact = typeof artifacts.$inferSelect
export type ShareLink = typeof shareLinks.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type RetentionSettings = typeof retentionSettings.$inferSelect
