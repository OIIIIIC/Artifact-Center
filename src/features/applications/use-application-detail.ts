import { useEffect, useMemo, useState } from 'react'

import { MOCK_APPLICATIONS } from '@/mocks/applications'
import { getArtifactsForApplication, getLatestArtifact } from '@/mocks/artifacts'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'

const LOAD_MS = 420

export function useApplicationDetail(id: string | undefined) {
  const [loadedId, setLoadedId] = useState<string | undefined | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setLoadedId(id), LOAD_MS)
    return () => window.clearTimeout(t)
  }, [id])

  const loading = loadedId !== id

  const application = useMemo<Application | undefined>(
    () => MOCK_APPLICATIONS.find((a) => a.id === id),
    [id],
  )

  const artifacts = useMemo<Artifact[]>(
    () => (id ? getArtifactsForApplication(id) : []),
    [id],
  )

  const latest = useMemo(() => (id ? getLatestArtifact(id) : undefined), [id])

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
