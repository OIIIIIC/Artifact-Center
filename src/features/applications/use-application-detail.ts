import { useEffect, useMemo, useState } from 'react'

import { useApplicationsStore } from '@/store/applications-store'
import { useArtifactsStore } from '@/store/artifacts-store'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'

const LOAD_MS = 420

export function useApplicationDetail(id: string | undefined) {
  const created = useApplicationsStore((s) => s.created)
  const overrides = useApplicationsStore((s) => s.overrides)
  const deletedIds = useApplicationsStore((s) => s.deletedIds)
  const getById = useApplicationsStore((s) => s.getById)
  const published = useArtifactsStore((s) => s.published)
  const getForApplication = useArtifactsStore((s) => s.getForApplication)
  const getLatest = useArtifactsStore((s) => s.getLatest)
  /** When id changes, readyId lags until timeout → loading without sync setState in effect */
  const [readyId, setReadyId] = useState<string | undefined>()

  useEffect(() => {
    const t = window.setTimeout(() => setReadyId(id), LOAD_MS)
    return () => window.clearTimeout(t)
  }, [id])

  const loading = id !== readyId

  // Subscribe to store slices so catalog mutations re-render detail
  void created
  void overrides
  void deletedIds
  void published

  const application = useMemo<Application | undefined>(() => {
    if (!id) return undefined
    return getById(id)
  }, [id, getById, created, overrides, deletedIds])

  const artifacts = useMemo<Artifact[]>(
    () => (id && application ? getForApplication(id) : []),
    [id, application, getForApplication, published],
  )

  const latest = useMemo(
    () => (id && application ? getLatest(id) : undefined),
    [id, application, getLatest, published],
  )

  const recentVersions = useMemo(() => artifacts.slice(0, 3), [artifacts])

  return {
    loading,
    application,
    artifacts,
    latest,
    recentVersions,
    notFound: !loading && !application,
  }
}
