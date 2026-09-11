import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { apiListProjects } from '@/services/api'

export function useProjects() {
  const query = useQuery({ queryKey: queryKeys.projects, queryFn: apiListProjects })
  return {
    projects: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
