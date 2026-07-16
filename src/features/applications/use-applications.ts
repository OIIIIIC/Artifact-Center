import { useEffect, useMemo, useState } from 'react'

import { filterApplications } from '@/features/applications/filter-applications'
import { MOCK_APPLICATIONS } from '@/mocks/applications'
import type { Application, ApplicationFilters } from '@/types/application'

const LOAD_MS = 450

export function useApplications() {
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

  const applications: Application[] = loaded ? MOCK_APPLICATIONS : []
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
