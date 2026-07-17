import { useEffect, useMemo, useState } from 'react'

import { filterApplications } from '@/features/applications/filter-applications'
import { useApplicationsStore } from '@/store/applications-store'
import type { ApplicationFilters } from '@/types/application'

const LOAD_MS = 350

export function useApplications() {
  const created = useApplicationsStore((s) => s.created)
  const overrides = useApplicationsStore((s) => s.overrides)
  const deletedIds = useApplicationsStore((s) => s.deletedIds)
  const getCatalog = useApplicationsStore((s) => s.getCatalog)
  const [loaded, setLoaded] = useState(false)
  const [filters, setFilters] = useState<ApplicationFilters>({
    query: '',
    platform: 'all',
    sort: 'updated',
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), LOAD_MS)
    return () => window.clearTimeout(timer)
  }, [])

  // Recompute when catalog mutations change
  const applications = useMemo(
    () => (loaded ? getCatalog() : []),
    [loaded, created, overrides, deletedIds, getCatalog],
  )
  const loading = !loaded

  const filtered = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
  )

  return {
    loading,
    applications,
    filtered,
    filters,
    setFilters,
    isEmptyCatalog: !loading && applications.length === 0,
    isSearchEmpty: !loading && applications.length > 0 && filtered.length === 0,
  }
}
