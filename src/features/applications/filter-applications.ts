import type { Application, ApplicationFilters } from '@/types/application'

export function filterApplications(
  apps: Application[],
  filters: ApplicationFilters,
): Application[] {
  const q = filters.query.trim().toLowerCase()

  let result = apps.filter((app) => {
    if (filters.platform !== 'all' && app.platform !== filters.platform) {
      return false
    }
    if (!q) return true
    return (
      app.name.toLowerCase().includes(q) ||
      app.packageName.toLowerCase().includes(q) ||
      app.owner.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q)
    )
  })

  result = [...result].sort((a, b) => {
    switch (filters.sort) {
      case 'name':
        return a.name.localeCompare(b.name, 'zh-CN')
      case 'created':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'updated':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
  })

  return result
}
