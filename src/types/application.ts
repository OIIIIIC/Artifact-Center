export type ApplicationPlatform = 'android' | 'windows' | 'zip'

/**
 * Lifecycle / release signals shown on cards.
 * `active` = healthy, no status chip.
 */
export type ApplicationStatus = 'active' | 'new' | 'beta' | 'deprecated' | 'archived'

export type ApplicationSort = 'updated' | 'name' | 'created'

export interface Region {
  id: string
  code: string
  name: string
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface Application {
  id: string
  name: string
  description: string
  packageName: string
  platform: ApplicationPlatform
  region: Region
  latestVersion: string
  /** Latest artifact upload time; distinct from application metadata updates. */
  latestArtifactUploadedAt?: string | null
  updatedAt: string
  createdAt: string
  owner: string
  /** 应用列表中的成员预览，用于快速识别参与该应用的人员。 */
  members?: Array<{
    id: string
    name: string
    avatarUrl: string | null
  }>
  artifactCount: number
  status: ApplicationStatus
  /** Mock git-style remote for detail summary */
  repository: string
}

export interface ApplicationFilters {
  query: string
  platform: ApplicationPlatform | 'all'
  sort: ApplicationSort
}
