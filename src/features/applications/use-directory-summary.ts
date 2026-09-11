import { useQuery } from '@tanstack/react-query'
import { apiDirectorySummary } from '@/services/api'
import { queryKeys } from '@/lib/query-keys'

export function useDirectorySummary() {
  return useQuery({
    queryKey: queryKeys.applications.summary,
    queryFn: ({ signal }) => apiDirectorySummary(signal),
  })
}
