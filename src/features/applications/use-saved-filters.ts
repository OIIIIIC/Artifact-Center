import type {
  ApplicationFilters,
  ApplicationPlatform,
  ApplicationSort,
} from '@/types/application'

const STORAGE_KEY = 'artifact-center.application-filter-prefs.v1'

const PLATFORMS = new Set<ApplicationPlatform | 'all'>([
  'all',
  'android',
  'windows',
  'zip',
])
const SORTS = new Set<ApplicationSort>(['updated', 'name', 'created'])

export type SavedFilterPrefs = {
  /** 个人默认平台；不写入可分享 URL */
  platform: ApplicationPlatform | 'all'
  /** 个人默认排序 */
  sort: ApplicationSort
}

const DEFAULT_PREFS: SavedFilterPrefs = {
  platform: 'all',
  sort: 'updated',
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * 读取个人筛选偏好（localStorage）。
 * 与 URL 筛选并存：仅当 URL 未指定 platform/sort 时由调用方合并。
 */
export function readSavedFilterPrefs(): SavedFilterPrefs {
  if (!canUseStorage()) return { ...DEFAULT_PREFS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<SavedFilterPrefs>
    const platform =
      parsed.platform && PLATFORMS.has(parsed.platform) ? parsed.platform : 'all'
    const sort = parsed.sort && SORTS.has(parsed.sort) ? parsed.sort : 'updated'
    return { platform, sort }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/** 持久化个人筛选偏好；不写入 query string。 */
export function writeSavedFilterPrefs(
  prefs: Partial<SavedFilterPrefs>,
): SavedFilterPrefs {
  const current = readSavedFilterPrefs()
  const next: SavedFilterPrefs = {
    platform:
      prefs.platform && PLATFORMS.has(prefs.platform) ? prefs.platform : current.platform,
    sort: prefs.sort && SORTS.has(prefs.sort) ? prefs.sort : current.sort,
  }
  if (!canUseStorage()) return next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式 / 配额满时静默失败
  }
  return next
}

/**
 * 将个人偏好合并进当前筛选。
 * URL 已显式带 platform/sort 时以 URL 为准（可分享链接不被本地偏好污染）。
 */
export function mergeFiltersWithSavedPrefs(
  filters: ApplicationFilters,
  url: URLSearchParams,
  prefs: SavedFilterPrefs = readSavedFilterPrefs(),
): ApplicationFilters {
  return {
    ...filters,
    platform: url.has('platform') ? filters.platform : prefs.platform,
    sort: url.has('sort') ? filters.sort : prefs.sort,
  }
}
