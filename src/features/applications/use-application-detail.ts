import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import { queryKeys } from '@/lib/query-keys'
import {
  apiGetApplication,
  apiApplicationOverview,
  apiRecordApplicationVisit,
} from '@/services/api'
import { ApiError } from '@/services/http'
import type { Application } from '@/types/application'

export function useApplicationDetail(id: string | undefined) {
  const queryClient = useQueryClient()
  const recordedVisit = useRef<string | null>(null)
  const appQuery = useQuery({
    queryKey: queryKeys.applications.detail(id ?? ''),
    queryFn: () => apiGetApplication(id!),
    enabled: Boolean(id),
    retry: (count, err) => {
      // Don't retry hard 404s
      if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
        return false
      }
      return count < 1
    },
  })

  const overviewQuery = useQuery({
    queryKey: [...queryKeys.artifacts.byApp(id ?? ''), 'overview'],
    queryFn: ({ signal }) => apiApplicationOverview(id!, signal),
    enabled: Boolean(id) && appQuery.isSuccess,
  })

  useEffect(() => {
    if (!id || !appQuery.isSuccess || recordedVisit.current === id) return
    recordedVisit.current = id
    void apiRecordApplicationVisit(id)
      .then(() =>
        queryClient.invalidateQueries({ queryKey: queryKeys.personalWorkspace }),
      )
      .catch(() => {
        // 最近访问属于增强体验，失败不应阻断应用详情主路径。
        recordedVisit.current = null
      })
  }, [appQuery.isSuccess, id, queryClient])

  const loading =
    Boolean(id) && (appQuery.isLoading || (appQuery.isSuccess && overviewQuery.isLoading))
  const application = useMemo<Application | undefined>(
    () => appQuery.data,
    [appQuery.data],
  )
  const latest = overviewQuery.data?.latest
  const recentVersions = overviewQuery.data?.recent ?? []
  const error = appQuery.error ?? overviewQuery.error ?? null
  const notFound =
    Boolean(id) &&
    !loading &&
    appQuery.error instanceof ApiError &&
    appQuery.error.status === 404
  const loadError = Boolean(id) && !loading && Boolean(error) && !notFound

  return {
    loading,
    application,
    latest,
    recentVersions,
    notFound,
    loadError,
    refetch: async () => {
      await Promise.all([appQuery.refetch(), overviewQuery.refetch()])
    },
  }
}
