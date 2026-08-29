import { useCallback, useEffect, useRef } from 'react'

import type { PersonalWorkspacePreferences } from '@/services/api'

export type WorkspaceFilterPreferenceSnapshot = Pick<
  PersonalWorkspacePreferences,
  'query' | 'platform' | 'sort' | 'regionId' | 'favoriteOnly' | 'responsibleOnly'
>

type WorkspaceFilterPreferenceSyncOptions = {
  current: PersonalWorkspacePreferences
  next: WorkspaceFilterPreferenceSnapshot
  loading: boolean
  onPersist: (preferences: WorkspaceFilterPreferenceSnapshot) => void
  queryDelay?: number
}

function isSamePreferenceSnapshot(
  current: WorkspaceFilterPreferenceSnapshot,
  next: WorkspaceFilterPreferenceSnapshot,
) {
  return (
    current.query === next.query &&
    current.platform === next.platform &&
    current.sort === next.sort &&
    current.regionId === next.regionId &&
    current.favoriteOnly === next.favoriteOnly &&
    current.responsibleOnly === next.responsibleOnly
  )
}

export function useWorkspaceFilterPreferenceSync({
  current,
  next,
  loading,
  onPersist,
  queryDelay = 350,
}: WorkspaceFilterPreferenceSyncOptions) {
  const timerRef = useRef<number | undefined>(undefined)
  const pendingRef = useRef<WorkspaceFilterPreferenceSnapshot | undefined>(undefined)
  const persistRef = useRef(onPersist)
  const {
    query: nextQuery,
    platform: nextPlatform,
    sort: nextSort,
    regionId: nextRegionId,
    favoriteOnly: nextFavoriteOnly,
    responsibleOnly: nextResponsibleOnly,
  } = next
  const {
    query: currentQuery,
    platform: currentPlatform,
    sort: currentSort,
    regionId: currentRegionId,
    favoriteOnly: currentFavoriteOnly,
    responsibleOnly: currentResponsibleOnly,
  } = current

  useEffect(() => {
    persistRef.current = onPersist
  }, [onPersist])

  const flush = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = undefined
    persistRef.current(pending)
  }, [])

  useEffect(() => {
    if (loading) return

    const nextSnapshot: WorkspaceFilterPreferenceSnapshot = {
      query: nextQuery,
      platform: nextPlatform,
      sort: nextSort,
      regionId: nextRegionId,
      favoriteOnly: nextFavoriteOnly,
      responsibleOnly: nextResponsibleOnly,
    }
    const currentSnapshot: WorkspaceFilterPreferenceSnapshot = {
      query: currentQuery,
      platform: currentPlatform,
      sort: currentSort,
      regionId: currentRegionId,
      favoriteOnly: currentFavoriteOnly,
      responsibleOnly: currentResponsibleOnly,
    }

    if (isSamePreferenceSnapshot(currentSnapshot, nextSnapshot)) {
      pendingRef.current = undefined
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
      return
    }

    pendingRef.current = nextSnapshot
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)

    if (currentQuery === nextQuery) {
      flush()
      return
    }

    timerRef.current = window.setTimeout(flush, queryDelay)
    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
    }
  }, [
    currentFavoriteOnly,
    currentPlatform,
    currentQuery,
    currentRegionId,
    currentResponsibleOnly,
    currentSort,
    flush,
    loading,
    nextFavoriteOnly,
    nextPlatform,
    nextQuery,
    nextRegionId,
    nextResponsibleOnly,
    nextSort,
    queryDelay,
  ])

  useEffect(() => () => flush(), [flush])
}
