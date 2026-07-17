import { useArtifactsStore } from '@/store/artifacts-store'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'

export type ApplicationHit = {
  kind: 'application'
  application: Application
  score: number
}

export type ArtifactHit = {
  kind: 'artifact'
  artifact: Artifact
  application: Application
  score: number
}

export type SearchResults = {
  query: string
  applications: ApplicationHit[]
  artifacts: ArtifactHit[]
  total: number
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function scoreText(haystack: string, needle: string): number {
  const h = normalize(haystack)
  const n = normalize(needle)
  if (!n || !h) return 0
  if (h === n) return 100
  if (h.startsWith(n)) return 80
  if (h.includes(n)) return 50
  // token match
  const parts = n.split(/[\s._/-]+/).filter(Boolean)
  if (parts.length > 1 && parts.every((p) => h.includes(p))) return 40
  return 0
}

function scoreApplication(app: Application, q: string): number {
  return Math.max(
    scoreText(app.name, q),
    scoreText(app.packageName, q) * 0.95,
    scoreText(app.description, q) * 0.6,
    scoreText(app.owner, q) * 0.55,
    scoreText(app.repository, q) * 0.5,
    scoreText(app.latestVersion, q) * 0.7,
  )
}

function scoreArtifact(art: Artifact, app: Application, q: string): number {
  return Math.max(
    scoreText(art.version, q),
    scoreText(art.filename, q) * 0.9,
    scoreText(art.buildNumber, q) * 0.75,
    scoreText(art.uploader, q) * 0.5,
    scoreText(art.releaseNotes, q) * 0.4,
    scoreText(app.name, q) * 0.35,
    scoreText(app.packageName, q) * 0.35,
  )
}

/**
 * Client-side global search over catalog applications + mock artifacts.
 */
export function runSearch(
  rawQuery: string,
  applications: Application[],
  limits?: { applications?: number; artifacts?: number },
): SearchResults {
  const query = rawQuery.trim()
  const appLimit = limits?.applications ?? 8
  const artLimit = limits?.artifacts ?? 12

  if (!query) {
    return { query, applications: [], artifacts: [], total: 0 }
  }

  const applicationsHits: ApplicationHit[] = applications
    .map((application) => ({
      kind: 'application' as const,
      application,
      score: scoreApplication(application, query),
    }))
    .filter((h) => h.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.application.name.localeCompare(b.application.name),
    )
    .slice(0, appLimit)

  const getArts = useArtifactsStore.getState().getForApplication
  const artifactsHits: ArtifactHit[] = []
  for (const application of applications) {
    const arts = getArts(application.id)
    for (const artifact of arts) {
      const score = scoreArtifact(artifact, application, query)
      if (score > 0) {
        artifactsHits.push({ kind: 'artifact', artifact, application, score })
      }
    }
  }
  artifactsHits.sort(
    (a, b) =>
      b.score - a.score || b.artifact.uploadedAt.localeCompare(a.artifact.uploadedAt),
  )

  const artifacts = artifactsHits.slice(0, artLimit)

  return {
    query,
    applications: applicationsHits,
    artifacts,
    total: applicationsHits.length + artifacts.length,
  }
}
