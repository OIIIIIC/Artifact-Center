import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { queryKeys } from '@/lib/query-keys'
import { apiGetApplication, apiListArtifacts } from '@/services/api'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'

export function useApplicationDetail(id: string | undefined) {
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

  const artsQuery = useQuery({
    queryKey: queryKeys.artifacts.byApp(id ?? ''),
    queryFn: () => apiListArtifacts(id!),
    enabled: Boolean(id) && appQuery.isSuccess,
  })

  const loading =
    Boolean(id) && (appQuery.isLoading || (appQuery.isSuccess && artsQuery.isLoading))

  const application = useMemo<Application | undefined>(
    () => appQuery.data,
    [appQuery.data],
  )

  const artifacts = useMemo<Artifact[]>(() => artsQuery.data ?? [], [artsQuery.data])

  const latest = useMemo(
    () => artifacts.find((a) => a.status === 'latest') ?? artifacts[0],
    [artifacts],
  )

  const recentVersions = useMemo(() => artifacts.slice(0, 3), [artifacts])

  const notFound =
    Boolean(id) && !loading && (appQuery.isError || (!appQuery.isLoading && !application))

  return {
    loading,
    application,
    artifacts,
    latest,
    recentVersions,
    notFound,
    refetch: async () => {
      await Promise.all([appQuery.refetch(), artsQuery.refetch()])
    },
  }
}
