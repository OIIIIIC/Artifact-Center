import type { PersonalWorkspacePreferences } from '@/services/api'

export function buildRestoredApplicationSearch(
  preferences: PersonalWorkspacePreferences,
): string {
  const params = new URLSearchParams()
  const query = preferences.query.trim().slice(0, 120)

  if (query) params.set('q', query)
  // 恢复链接必须显式携带默认值，避免另一台设备的 localStorage 偏好覆盖服务端快照。
  params.set('platform', preferences.platform)
  params.set('sort', preferences.sort)
  if (preferences.regionId) params.set('region', preferences.regionId)
  if (preferences.favoriteOnly) params.set('favorites', '1')
  if (preferences.responsibleOnly) params.set('scope', 'mine')

  return params.toString()
}
