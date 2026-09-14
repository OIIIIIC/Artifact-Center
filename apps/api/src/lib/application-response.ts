import { applications, regions } from '../db/schema.js'

function mapRegion(row: typeof regions.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type ApplicationMemberPreview = {
  id: string
  name: string
  avatarUrl: string | null
}

export type ApplicationResponseRow = Pick<
  typeof applications.$inferSelect,
  | 'id'
  | 'name'
  | 'applicationCode'
  | 'iconKey'
  | 'iconColor'
  | 'description'
  | 'packageName'
  | 'platform'
  | 'regionId'
  | 'repository'
  | 'status'
  | 'ownerName'
  | 'latestVersion'
  | 'artifactCount'
  | 'createdAt'
  | 'updatedAt'
> & {
  latestArtifactUploadedAt?: Date | string | null
  projectId?: string
}

/** 目录与搜索结果不读取 ownerId 等不会返回给客户端的列。 */
export const applicationResponseColumns = {
  id: applications.id,
  name: applications.name,
  applicationCode: applications.applicationCode,
  iconKey: applications.iconKey,
  iconColor: applications.iconColor,
  description: applications.description,
  packageName: applications.packageName,
  platform: applications.platform,
  regionId: applications.regionId,
  projectId: applications.projectId,
  repository: applications.repository,
  status: applications.status,
  ownerName: applications.ownerName,
  latestVersion: applications.latestVersion,
  artifactCount: applications.artifactCount,
  createdAt: applications.createdAt,
  updatedAt: applications.updatedAt,
}

function toIsoTimestamp(value: Date | string | null | undefined) {
  if (value == null) return null
  return typeof value === 'string' ? new Date(value).toISOString() : value.toISOString()
}

export function mapApp(
  row: ApplicationResponseRow,
  region: typeof regions.$inferSelect,
  members: ApplicationMemberPreview[] = [],
  accessRole: 'admin' | 'maintainer' | 'viewer' = 'viewer',
  project?: { name: string; code: string | null },
) {
  return {
    id: row.id,
    name: row.name,
    applicationCode: row.applicationCode,
    iconKey: row.iconKey,
    iconColor: row.iconColor,
    description: row.description,
    packageName: row.packageName,
    platform: row.platform,
    region: mapRegion(region),
    projectId: row.projectId,
    projectName: project?.name,
    projectCode: project?.code,
    repository: row.repository,
    status: row.status,
    owner: row.ownerName,
    members,
    accessRole,
    latestVersion: row.latestVersion,
    artifactCount: row.artifactCount,
    latestArtifactUploadedAt: toIsoTimestamp(row.latestArtifactUploadedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
