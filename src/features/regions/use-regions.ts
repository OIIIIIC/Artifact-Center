import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { apiListRegions } from '@/services/api'

export function useRegions() {
  const query = useQuery({
    queryKey: queryKeys.regions.list,
    queryFn: apiListRegions,
  })

  const regions = query.data ?? []

  return {
    regions,
    enabledRegions: regions.filter((region) => region.enabled),
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
