import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { filterApplications } from '@/features/applications/filter-applications'
import { queryKeys } from '@/lib/query-keys'
import { apiListApplications } from '@/services/api'
import type { ApplicationFilters } from '@/types/application'

export function useApplications() {
  const [filters, setFilters] = useState<ApplicationFilters>({
    query: '',
    platform: 'all',
    sort: 'updated',
  })

  const query = useQuery({
    queryKey: queryKeys.applications.list({
      // Server supports q/platform/sort; we still filter client-side for snappy UX
      // when typing, but fetch full catalog once.
      sort: 'updated',
    }),
    queryFn: () => apiListApplications({ sort: 'updated' }),
  })

  const applications = useMemo(() => query.data ?? [], [query.data])
  const loading = query.isLoading

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
    error: query.error,
    refetch: query.refetch,
  }
}

/** Catalog for pickers / create / search — full application list. */
export function useApplicationCatalog() {
  const query = useQuery({
    queryKey: queryKeys.applications.list({ sort: 'updated' }),
    queryFn: () => apiListApplications({ sort: 'updated' }),
  })

  return {
    catalog: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
