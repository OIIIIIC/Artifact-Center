import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import {
  mergeFiltersWithSavedPrefs,
  writeSavedFilterPrefs,
} from '@/features/applications/use-saved-filters'
import { queryKeys } from '@/lib/query-keys'
import { apiApplicationPage, apiListApplications } from '@/services/api'
import type {
  ApplicationFilters,
  ApplicationPlatform,
  ApplicationSort,
} from '@/types/application'

import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useCollectionPage } from '@/hooks/use-collection-page'

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
  const location = useLocation()
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

  const settledQuery = useDebouncedValue(filters.query)
  const scope = {
    q: settledQuery,
    platform: filters.platform,
    sort: filters.sort,
    product: searchParams.get('product') ?? searchParams.get('region') ?? undefined,
    project: searchParams.get('project') ?? undefined,
    scope: searchParams.get('scope') ?? undefined,
    favorites: searchParams.get('favorites') ?? undefined,
  }
  const query = useCollectionPage({
    cacheKey: location.key,
    queryKey: ['applications', 'page', scope],
    queryFn: (cursor, signal) =>
      apiApplicationPage({ ...scope, cursor, limit: 24 }, signal),
  })
  const applications = useMemo(() => query.data?.items ?? [], [query.data])
  const loading = query.isLoading
  // 以实际展示内容作为过渡标识：placeholderData 保留旧列表时标识不变，
  // 新筛选结果真正到达且内容变化后才触发现有的淡入过渡。
  const transitionKey = applications
    .map((application) =>
      [
        application.id,
        application.name,
        application.platform,
        application.region.id,
        application.latestVersion,
        application.updatedAt,
        application.owner,
        application.artifactCount,
        application.status,
      ].join(':'),
    )
    .join('|')

  const filtered = applications

  return {
    loading,
    total: query.data?.total ?? 0,
    pagination: {
      page: query.page,
      hasNext: query.hasNext,
      hasPrevious: query.hasPrevious,
      next: query.next,
      previous: query.previous,
      busy: query.isFetching,
    },
    refreshing: query.isFetching && query.isPlaceholderData,
    resultsPending: query.isFetching || filters.query !== settledQuery,
    transitionKey,
    applications,
    filtered,
    filters,
    setFilters,
    isEmptyCatalog:
      !loading &&
      !query.isError &&
      applications.length === 0 &&
      !filters.query.trim() &&
      filters.platform === 'all' &&
      !scope.product &&
      !scope.project &&
      !scope.favorites &&
      !scope.scope,
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
export function useApplicationCatalog(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.applications.list({ sort: 'updated' }),
    queryFn: ({ signal }) => apiListApplications({ sort: 'updated' }, signal),
    enabled,
  })

  return {
    catalog: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
