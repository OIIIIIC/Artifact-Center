import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  mergeFiltersWithSavedPrefs,
  writeSavedFilterPrefs,
} from '@/features/applications/use-saved-filters'
import { queryKeys } from '@/lib/query-keys'
import { apiListApplications } from '@/services/api'
import type {
  ApplicationFilters,
  ApplicationPlatform,
  ApplicationSort,
} from '@/types/application'

const PLATFORMS = new Set<ApplicationPlatform>(['android', 'windows', 'zip'])
const SORTS = new Set<ApplicationSort>(['updated', 'name', 'created'])

export function parseApplicationFilters(params: URLSearchParams): ApplicationFilters {
  const platform = params.get('platform')
  const sort = params.get('sort')
  return {
    query: (params.get('q') ?? '').slice(0, 120),
    platform:
      platform && PLATFORMS.has(platform as ApplicationPlatform)
        ? (platform as ApplicationPlatform)
        : 'all',
    sort:
      sort && SORTS.has(sort as ApplicationSort) ? (sort as ApplicationSort) : 'updated',
  }
}

export function writeApplicationFilters(
  current: URLSearchParams,
  filters: ApplicationFilters,
): URLSearchParams {
  const next = new URLSearchParams(current)
  const query = filters.query.slice(0, 120)

  if (query) next.set('q', query)
  else next.delete('q')
  if (filters.platform === 'all') next.delete('platform')
  else next.set('platform', filters.platform)
  if (filters.sort === 'updated') next.delete('sort')
  else next.set('sort', filters.sort)

  return next
}

export function useApplications() {
  const [searchParams, setSearchParams] = useSearchParams()
  /** URL 优先；未写在 URL 上的 platform/sort 用个人 localStorage 偏好补全（UX-04）。 */
  const filters = useMemo(() => {
    const fromUrl = parseApplicationFilters(searchParams)
    return mergeFiltersWithSavedPrefs(fromUrl, searchParams)
  }, [searchParams])
  const setFilters = useCallback(
    (next: ApplicationFilters) => {
      writeSavedFilterPrefs({ platform: next.platform, sort: next.sort })
      setSearchParams((current) => writeApplicationFilters(current, next), {
        replace: true,
      })
    },
    [setSearchParams],
  )

  const query = useQuery({
    queryKey: queryKeys.applications.list({
      q: filters.query,
      platform: filters.platform,
      sort: filters.sort,
    }),
    queryFn: ({ signal }) =>
      apiListApplications(
        {
          q: filters.query,
          platform: filters.platform,
          sort: filters.sort,
        },
        signal,
      ),
  })

  const applications = useMemo(() => query.data ?? [], [query.data])
  const loading = query.isLoading

  const filtered = applications

  return {
    loading,
    applications,
    filtered,
    filters,
    setFilters,
    isEmptyCatalog:
      !loading &&
      !query.isError &&
      applications.length === 0 &&
      !filters.query.trim() &&
      filters.platform === 'all',
    isSearchEmpty:
      !loading &&
      !query.isError &&
      applications.length === 0 &&
      (Boolean(filters.query.trim()) || filters.platform !== 'all'),
    error: query.error,
    refetch: query.refetch,
  }
}

/** Catalog for pickers / create / search — full application list. */
export function useApplicationCatalog() {
  const query = useQuery({
    queryKey: queryKeys.applications.list({ sort: 'updated' }),
    queryFn: ({ signal }) => apiListApplications({ sort: 'updated' }, signal),
  })

  return {
    catalog: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
