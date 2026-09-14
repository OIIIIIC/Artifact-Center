import type { ApplicationPlatform } from '@/lib/artifact-types'
export type { ApplicationPlatform } from '@/lib/artifact-types'

/**
 * Lifecycle / release signals shown on cards.
 * `active` = healthy, no status chip.
 */
export type ApplicationStatus = 'active' | 'new' | 'beta' | 'deprecated' | 'archived'

export type ApplicationSort = 'updated' | 'name' | 'created'
export type ApplicationAccessRole = 'admin' | 'maintainer' | 'viewer'

export type ApplicationIconKey =
  | 'auto'
  | 'monitor'
  | 'smartphone'
  | 'tablet'
  | 'heart-pulse'
  | 'stethoscope'
  | 'shield'
  | 'package'
  | 'radio'
  | 'building'
  | 'activity'
  | 'settings'

export type ApplicationIconColor =
  | 'auto'
  | 'mint'
  | 'blue'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'orange'
  | 'slate'
  | 'cyan'
  | 'lime'

export interface Product {
  id: string
  code: string
  name: string
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** Legacy wire name retained for existing APIs and integrations. */
export type Region = Product

export interface Project {
  id: string
  productId: string
  name: string
  /** Download prefix; absent on legacy responses, null uses the product code. */
  code?: string | null
  sortOrder: number
  enabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface Application {
  id: string
  name: string
  /** Stable short identifier used in distribution filenames. */
  applicationCode: string
  iconKey?: ApplicationIconKey
  iconColor?: ApplicationIconColor
  description: string
  packageName: string
  platform: ApplicationPlatform
  region: Region
  /** Present on current APIs; optional only for legacy cached responses. */
  projectCode?: string | null
  projectName?: string
  projectId?: string
  latestVersion: string
  /** Latest artifact upload time; distinct from application metadata updates. */
  latestArtifactUploadedAt?: string | null
  updatedAt: string
  createdAt: string
  owner: string
  /** 当前登录用户在该应用中的有效权限；平台管理员统一返回 admin。 */
  accessRole?: ApplicationAccessRole
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
