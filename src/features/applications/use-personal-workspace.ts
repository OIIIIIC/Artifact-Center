import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { queryKeys } from '@/lib/query-keys'
import {
  apiGetPersonalWorkspace,
  apiSetApplicationFavorite,
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

  const favoriteMutation = useMutation({
    mutationFn: ({
      applicationId,
      favorite,
    }: {
      applicationId: string
      favorite: boolean
    }) => apiSetApplicationFavorite(applicationId, favorite),
    onMutate: async ({ applicationId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.personalWorkspace })
      const previous = queryClient.getQueryData<PersonalWorkspace>(
        queryKeys.personalWorkspace,
      )
      const current = previous ?? EMPTY_WORKSPACE
      queryClient.setQueryData<PersonalWorkspace>(queryKeys.personalWorkspace, {
        ...current,
        favoriteApplicationIds: favorite
          ? [
              applicationId,
              ...current.favoriteApplicationIds.filter((id) => id !== applicationId),
            ]
          : current.favoriteApplicationIds.filter((id) => id !== applicationId),
      })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.personalWorkspace, context.previous)
      } else {
        queryClient.removeQueries({ queryKey: queryKeys.personalWorkspace })
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.personalWorkspace }),
  })

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
    toggleFavorite: (applicationId: string) =>
      favoriteMutation.mutate({
        applicationId,
        favorite: !favoriteIds.has(applicationId),
      }),
    favoritePendingId: favoriteMutation.isPending
      ? favoriteMutation.variables?.applicationId
      : undefined,
    updatePreferences,
  }
}
