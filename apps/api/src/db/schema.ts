import {
  bigint,
  boolean,
  check,
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
import { sql } from 'drizzle-orm'

export const userRoleEnum = pgEnum('user_role', ['admin', 'maintainer', 'viewer'])

export const applicationMemberRoleEnum = pgEnum('application_member_role', [
  'maintainer',
  'viewer',
])

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

export const artifactTypeEnum = pgEnum('artifact_type', ['apk', 'aab', 'exe', 'zip'])

export const uploadSessionStatusEnum = pgEnum('upload_session_status', [
  'active',
  'completed',
  'cancelled',
])

export const releaseStatusEnum = pgEnum('release_status', [
  'published',
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

export const shareKindEnum = pgEnum('share_kind', ['single', 'collection'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  /** 每次凭据或平台权限发生安全变化时递增，使旧 JWT 立即失效。 */
  tokenVersion: integer('token_version').notNull().default(0),
  /** 管理员停用账号后，认证中间件拒绝所有已签发和后续登录令牌。 */
  isActive: boolean('is_active').notNull().default(true),
  role: userRoleEnum('role').notNull().default('maintainer'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** 地域是管理员维护的应用目录分类，不作为一级产品导航对象。 */
export const regions = pgTable(
  'regions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('regions_code_uidx').on(t.code),
    uniqueIndex('regions_name_uidx').on(t.name),
    index('regions_sort_order_idx').on(t.sortOrder, t.name),
  ],
)

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    /** Stable short identifier used in distribution filenames. */
    applicationCode: varchar('application_code', { length: 48 }).notNull(),
    description: text('description').notNull().default(''),
    packageName: varchar('package_name', { length: 255 }).notNull(),
    platform: appPlatformEnum('platform').notNull(),
    regionId: uuid('region_id')
      .notNull()
      .references(() => regions.id, { onDelete: 'restrict' }),
    repository: varchar('repository', { length: 500 }).notNull().default(''),
    status: appStatusEnum('status').notNull().default('new'),
    ownerId: uuid('owner_id').references(() => users.id),
    ownerName: varchar('owner_name', { length: 120 }).notNull().default(''),
    latestVersion: varchar('latest_version', { length: 64 }).notNull().default(''),
    artifactCount: integer('artifact_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('applications_region_code_uidx').on(t.regionId, t.applicationCode),
    check(
      'applications_application_code_format',
      sql`${t.applicationCode} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
)

/** 应用内成员关系；平台管理员不需要显式成员记录。 */
export const applicationMembers = pgTable(
  'application_members',
  {
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: applicationMemberRoleEnum('role').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('application_members_application_user_uidx').on(
      t.applicationId,
      t.userId,
    ),
    index('application_members_user_application_idx').on(t.userId, t.applicationId),
  ],
)

/**
 * 平台级发布机器人凭据。
 * 可向任意 Application 的 beta/stable 渠道上传；数据库只保存高熵 Token 摘要。
 */
export const releaseCredentials = pgTable(
  'release_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('release_credentials_actor_idx').on(t.actorUserId)],
)

/**
 * Release 是应用内一个可读的发布上下文，可关联多个不同类型的制品。
 * 现有上传接口会按“应用 + 版本”自动创建或复用 Release。
 */
export const releases = pgTable(
  'releases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 64 }).notNull(),
    releaseNotes: text('release_notes').notNull().default(''),
    status: releaseStatusEnum('status').notNull().default('published'),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdByName: varchar('created_by_name', { length: 120 }).notNull().default(''),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('releases_application_version_uidx').on(t.applicationId, t.version),
    index('releases_application_published_at_idx').on(t.applicationId, t.publishedAt),
  ],
)

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 64 }).notNull(),
    buildNumber: varchar('build_number', { length: 64 }).notNull().default(''),
    platform: appPlatformEnum('platform').notNull(),
    type: artifactTypeEnum('type').notNull(),
    channel: channelEnum('channel').notNull().default('stable'),
    status: artifactStatusEnum('status').notNull().default('stable'),
    /** Filename supplied by the uploader; retained for provenance. */
    originalFilename: varchar('original_filename', { length: 500 }).notNull(),
    /** Immutable distribution filename returned to downloaders. */
    filename: varchar('filename', { length: 500 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    sha256: varchar('sha256', { length: 64 }),
    storageKey: text('storage_key').notNull(),
    /** local keeps existing files compatible; s3 is browser-direct multipart storage. */
    storageBackend: varchar('storage_backend', { length: 16 }).notNull().default('local'),
    releaseNotes: text('release_notes').notNull().default(''),
    uploaderId: uuid('uploader_id').references(() => users.id, { onDelete: 'set null' }),
    uploaderName: varchar('uploader_name', { length: 120 }).notNull().default(''),
    parsedMeta: jsonb('parsed_meta').$type<Record<string, unknown>>(),
    buildMeta: jsonb('build_meta').$type<Record<string, unknown>>(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** When status/channel became deprecated (for retention archive) */
    deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('artifacts_release_type_build_uidx').on(
      t.releaseId,
      t.type,
      t.buildNumber,
    ),
    uniqueIndex('artifacts_one_latest_per_application_uidx')
      .on(t.applicationId)
      .where(sql`${t.status} = 'latest'`),
    index('artifacts_application_uploaded_at_idx').on(t.applicationId, t.uploadedAt),
    index('artifacts_application_sha256_idx').on(t.applicationId, t.sha256),
    index('artifacts_release_id_idx').on(t.releaseId),
    check('artifacts_size_bytes_nonnegative', sql`${t.sizeBytes} >= 0`),
  ],
)

/** Resumable artifact upload: metadata is retained while chunks are being transferred. */
export const uploadSessions = pgTable(
  'upload_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resumeKey: varchar('resume_key', { length: 160 }).notNull(),
    filename: varchar('filename', { length: 500 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    fields: jsonb('fields').$type<Record<string, string>>().notNull(),
    storageKey: text('storage_key').notNull(),
    storageBackend: varchar('storage_backend', { length: 16 }).notNull().default('local'),
    objectUploadId: text('object_upload_id'),
    partSize: integer('part_size').notNull(),
    partCount: integer('part_count').notNull(),
    status: uploadSessionStatusEnum('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('upload_sessions_resume_idx').on(t.applicationId, t.uploaderId, t.resumeKey),
    index('upload_sessions_expires_idx').on(t.status, t.expiresAt),
    check('upload_sessions_size_nonnegative', sql`${t.sizeBytes} > 0`),
    check('upload_sessions_part_count_positive', sql`${t.partCount} > 0`),
  ],
)

export const uploadParts = pgTable(
  'upload_parts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => uploadSessions.id, { onDelete: 'cascade' }),
    partNumber: integer('part_number').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    etag: varchar('etag', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('upload_parts_session_number_uidx').on(t.sessionId, t.partNumber),
    check('upload_parts_number_positive', sql`${t.partNumber} > 0`),
    check('upload_parts_size_positive', sql`${t.sizeBytes} > 0`),
  ],
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
    /**
     * 明文令牌的 HMAC 摘要；公开 URL 中的明文只在创建时返回一次。
     * 迁移期仍保留可空的 legacy token 列供回填升级。
     */
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    /** @deprecated 仅遗留行；新写入必须为 null */
    token: varchar('token', { length: 64 }),
    kind: shareKindEnum('kind').notNull().default('single'),
    title: varchar('title', { length: 200 }).notNull().default(''),
    regionId: uuid('region_id').references(() => regions.id, {
      onDelete: 'set null',
    }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    mode: shareModeEnum('mode').notNull().default('latest'),
    artifactId: uuid('artifact_id').references(() => artifacts.id, {
      onDelete: 'cascade',
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
    index('share_links_application_created_at_idx').on(t.applicationId, t.createdAt),
    check(
      'share_links_mode_artifact_check',
      sql`(${t.mode} = 'latest' AND ${t.artifactId} IS NULL) OR (${t.mode} = 'artifact' AND ${t.artifactId} IS NOT NULL)`,
    ),
  ],
)

/** Share Collection 中的交付项；单制品分享也是只有一项的清单。 */
export const shareLinkItems = pgTable(
  'share_link_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shareLinkId: uuid('share_link_id')
      .notNull()
      .references(() => shareLinks.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    mode: shareModeEnum('mode').notNull().default('latest'),
    artifactId: uuid('artifact_id').references(() => artifacts.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order').notNull().default(0),
    downloadCount: integer('download_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('share_link_items_share_application_uidx').on(
      t.shareLinkId,
      t.applicationId,
    ),
    index('share_link_items_share_sort_idx').on(t.shareLinkId, t.sortOrder),
    index('share_link_items_application_idx').on(t.applicationId),
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
    index('audit_logs_application_created_at_idx').on(t.applicationId, t.createdAt),
    index('audit_logs_action_idx').on(t.action),
  ],
)

export type User = typeof users.$inferSelect
export type Region = typeof regions.$inferSelect
export type Application = typeof applications.$inferSelect
export type ApplicationMember = typeof applicationMembers.$inferSelect
export type Release = typeof releases.$inferSelect
export type Artifact = typeof artifacts.$inferSelect
export type ShareLink = typeof shareLinks.$inferSelect
export type ShareLinkItem = typeof shareLinkItems.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type RetentionSettings = typeof retentionSettings.$inferSelect
