import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { useFavoriteActions } from './use-favorite-actions'

import { queryKeys } from '@/lib/query-keys'
import {
  apiGetPersonalWorkspace,
  apiUpdatePersonalWorkspacePreferences,
  type PersonalWorkspace,
  type PersonalWorkspacePreferences,
} from '@/services/api'

const EMPTY_WORKSPACE: PersonalWorkspace = {
  favoriteApplicationIds: [],
  recentApplications: [],
  preferences: {
    platform: 'all',
    sort: 'updated',
    regionId: null,
    query: '',
    favoriteOnly: false,
    responsibleOnly: false,
    collapsed: false,
  },
}

export function usePersonalWorkspace() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.personalWorkspace,
    queryFn: ({ signal }) => apiGetPersonalWorkspace(signal),
  })
  const workspace = query.data ?? EMPTY_WORKSPACE
  const favoriteIds = useMemo(
    () => new Set(workspace.favoriteApplicationIds),
    [workspace.favoriteApplicationIds],
  )

  const favoriteActions = useFavoriteActions()

  const preferencesMutation = useMutation({
    scope: { id: 'personal-workspace-preferences' },
    mutationFn: (preferences: Partial<PersonalWorkspacePreferences>) =>
      apiUpdatePersonalWorkspacePreferences(preferences),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.personalWorkspace })
      const previous = queryClient.getQueryData<PersonalWorkspace>(
        queryKeys.personalWorkspace,
      )
      const current = previous ?? EMPTY_WORKSPACE
      queryClient.setQueryData<PersonalWorkspace>(queryKeys.personalWorkspace, {
        ...current,
        preferences: { ...current.preferences, ...preferences },
      })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.personalWorkspace, context.previous)
      }
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData<PersonalWorkspace>(
        queryKeys.personalWorkspace,
        (current) => ({
          ...(current ?? EMPTY_WORKSPACE),
          preferences,
        }),
      )
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.personalWorkspace }),
  })
  const mutatePreferences = preferencesMutation.mutate
  const updatePreferences = useCallback(
    (preferences: Partial<PersonalWorkspacePreferences>) =>
      mutatePreferences(preferences),
    [mutatePreferences],
  )

  return {
    workspace,
    favoriteIds,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    ...favoriteActions,
    updatePreferences,
  }
}
