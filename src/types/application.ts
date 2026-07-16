export type ApplicationPlatform = 'android' | 'windows' | 'zip'

/**
 * Lifecycle / release signals shown on cards.
 * `active` = healthy, no status chip.
 */
export type ApplicationStatus = 'active' | 'new' | 'beta' | 'deprecated' | 'archived'

export type ApplicationSort = 'updated' | 'name' | 'created'

export interface Application {
  id: string
  name: string
  description: string
  packageName: string
  platform: ApplicationPlatform
  latestVersion: string
  updatedAt: string
  createdAt: string
  owner: string
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
