import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { SearchResults } from '@/features/search/run-search'
import { apiSearch } from '@/services/api'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'

function scoreText(haystack: string, needle: string): number {
  const h = haystack.trim().toLowerCase()
  const n = needle.trim().toLowerCase()
  if (!n || !h) return 0
  if (h === n) return 100
  if (h.startsWith(n)) return 80
  if (h.includes(n)) return 50
  return 30
}

/**
 * Debounced server search for applications + artifacts.
 */
export function useServerSearch(
  rawQuery: string,
  limits?: { applications?: number; artifacts?: number },
  debounceMs = 280,
) {
  const [debounced, setDebounced] = useState(rawQuery.trim())

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(rawQuery.trim()), debounceMs)
    return () => window.clearTimeout(t)
  }, [rawQuery, debounceMs])

  const query = useQuery({
    queryKey: ['search', debounced, limits?.applications ?? 20, limits?.artifacts ?? 30],
    queryFn: () =>
      apiSearch(debounced, {
        apps: limits?.applications ?? 20,
        artifacts: limits?.artifacts ?? 30,
      }),
    enabled: debounced.length > 0,
    staleTime: 15_000,
  })

  const results: SearchResults = (() => {
    if (!debounced) {
      return { query: '', applications: [], artifacts: [], total: 0 }
    }
    if (!query.data) {
      return { query: debounced, applications: [], artifacts: [], total: 0 }
    }

    const applications = query.data.applications.map((application: Application) => ({
      kind: 'application' as const,
      application,
      score: Math.max(
        scoreText(application.name, debounced),
        scoreText(application.packageName, debounced),
      ),
    }))

    const artifacts = query.data.artifacts.map((row) => {
      const artifact = row.artifact as Artifact
      const application = {
        id: row.application.id,
        name: row.application.name,
        description: '',
        packageName: row.application.packageName,
        platform: row.application.platform,
        repository: '',
        status: 'active' as const,
        owner: '',
        latestVersion: '',
        artifactCount: 0,
        createdAt: '',
        updatedAt: '',
      } satisfies Application

      return {
        kind: 'artifact' as const,
        artifact,
        application,
        score: Math.max(
          scoreText(artifact.version, debounced),
          scoreText(artifact.filename, debounced),
        ),
      }
    })

    return {
      query: debounced,
      applications,
      artifacts,
      total: applications.length + artifacts.length,
    }
  })()

  return {
    results,
    loading: Boolean(debounced) && (query.isLoading || query.isFetching),
    error: query.error,
    debouncedQuery: debounced,
  }
}
