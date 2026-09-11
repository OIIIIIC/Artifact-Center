export const detailTabs = [
  'overview',
  'artifacts',
  'release-notes',
  'activity',
  'shares',
  'settings',
] as const

export function resolveDetailTab(tab: string | null, canWrite: boolean) {
  return tab &&
    detailTabs.includes(tab as (typeof detailTabs)[number]) &&
    (canWrite || !['settings', 'shares'].includes(tab))
    ? tab
    : 'overview'
}

export function applicationDirectoryHref(id: string, tab = 'overview') {
  const selected = resolveDetailTab(tab, true)
  return `/applications/${encodeURIComponent(id)}${selected !== 'overview' ? `?tab=${selected}` : ''}`
}
