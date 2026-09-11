import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { useState } from 'react'
import type { CollectionPage } from '@/services/api'

/** Only the active page is mounted; cached pages can be revisited without appending DOM. */
export function useCollectionPage<T>({
  queryKey,
  queryFn,
  enabled = true,
  cacheKey,
}: {
  queryKey: QueryKey
  queryFn: (cursor: string | undefined, signal: AbortSignal) => Promise<CollectionPage<T>>
  enabled?: boolean
  cacheKey?: string
}) {
  const client = useQueryClient()
  const scope = JSON.stringify([cacheKey, queryKey])
  type Navigation = { scope: string; cursors: (string | undefined)[]; index: number }
  const storageKey = ['collection-navigation', cacheKey]
  const restored = cacheKey ? client.getQueryData<Navigation>(storageKey) : undefined
  const initial: Navigation =
    restored?.scope === scope ? restored : { scope, cursors: [undefined], index: 0 }
  const [navigation, setNavigation] = useState<Navigation>(initial)
  const current = navigation.scope === scope ? navigation : initial
  if (navigation.scope !== scope) setNavigation(current)
  const navigate = (next: Navigation) => {
    setNavigation(next)
    if (cacheKey) client.setQueryData(storageKey, next)
  }
  const cursor = current.cursors[current.index]
  const query = useQuery({
    queryKey: [...queryKey, { cursor }],
    queryFn: ({ signal }) => queryFn(cursor, signal),
    enabled,
    placeholderData: keepPreviousData,
  })
  return {
    ...query,
    page: current.index + 1,
    hasPrevious: current.index > 0,
    hasNext: !!query.data?.nextCursor,
    previous: () => navigate({ ...current, index: Math.max(0, current.index - 1) }),
    next: () => {
      if (!query.data?.nextCursor || query.isFetching || query.isError) return
      navigate({
        scope,
        cursors: [...current.cursors.slice(0, current.index + 1), query.data.nextCursor],
        index: current.index + 1,
      })
    },
  }
}
