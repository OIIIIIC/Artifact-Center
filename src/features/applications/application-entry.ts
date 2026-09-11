import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import {
  apiApplicationPage,
  apiDirectorySummary,
  apiGetPersonalWorkspace,
  apiListProjects,
  apiListRegions,
} from '@/services/api'
import { loadApplicationsPage } from '@/routes/load-applications-page'
import { parseApplicationFilters } from './use-applications'
import { mergeFiltersWithSavedPrefs } from './use-saved-filters'

/** Prepare only the first page; all observers share the session's QueryClient. */
export function prepareApplicationEntry(client: QueryClient, search: string) {
  const params = new URLSearchParams(search)
  const filters = mergeFiltersWithSavedPrefs(parseApplicationFilters(params), params)
  const scope = {
    q: filters.query,
    platform: filters.platform,
    sort: filters.sort,
    product: params.get('product') ?? params.get('region') ?? undefined,
    project: params.get('project') ?? undefined,
    scope: params.get('scope') ?? undefined,
    favorites: params.get('favorites') ?? undefined,
  }
  // Code loading must not gate the independent data requests. The route handles
  // import failures; prefetch failures remain retryable in the normal query UI.
  void loadApplicationsPage().catch(() => {})
  return Promise.all([
    client.prefetchQuery({
      queryKey: ['applications', 'page', scope, { cursor: undefined }],
      queryFn: ({ signal }) => apiApplicationPage({ ...scope, limit: 24 }, signal),
    }),
    client.prefetchQuery({ queryKey: queryKeys.regions.list, queryFn: apiListRegions }),
    client.prefetchQuery({ queryKey: queryKeys.projects, queryFn: apiListProjects }),
    client.prefetchQuery({
      queryKey: queryKeys.applications.summary,
      queryFn: ({ signal }) => apiDirectorySummary(signal),
    }),
    client.prefetchQuery({
      queryKey: queryKeys.personalWorkspace,
      queryFn: ({ signal }) => apiGetPersonalWorkspace(signal),
    }),
  ])
}

/** Mounted only inside the validated authenticated shell, outside route Suspense. */
export function ApplicationEntryPreparation() {
  const client = useQueryClient()
  useEffect(() => {
    const current = new URL(window.location.href)
    if (current.pathname === '/' || current.pathname === '/login') {
      void prepareApplicationEntry(client, current.pathname === '/' ? current.search : '')
    }
    const onIntent = (event: Event) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor) return
      const target = new URL(anchor.href, window.location.href)
      if (target.origin !== window.location.origin || target.pathname !== '/') return
      if (anchor.hasAttribute('download') || anchor.target === '_blank') return
      void prepareApplicationEntry(client, target.search)
    }
    document.addEventListener('pointerover', onIntent, true)
    document.addEventListener('pointerdown', onIntent, true)
    document.addEventListener('focusin', onIntent, true)
    return () => {
      document.removeEventListener('pointerover', onIntent, true)
      document.removeEventListener('pointerdown', onIntent, true)
      document.removeEventListener('focusin', onIntent, true)
    }
  }, [client])
  return null
}
