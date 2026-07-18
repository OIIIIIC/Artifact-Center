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
 * Client-side global search over applications (+ optional per-app artifacts).
 * Artifact hits require a getArtifacts loader (e.g. React Query cache).
 */
export function runSearch(
  rawQuery: string,
  applications: Application[],
  limits?: { applications?: number; artifacts?: number },
  getArtifacts?: (appId: string) => Artifact[],
): SearchResults {
  const query = rawQuery.trim()
  const appLimit = limits?.applications ?? 8
  const artLimit = limits?.artifacts ?? 12

  if (!query) {
    return { query, applications: [], artifacts: [], total: 0 }
  }

  const appHits: ApplicationHit[] = applications
    .map((application) => ({
      kind: 'application' as const,
      application,
      score: scoreApplication(application, query),
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, appLimit)

  const artHits: ArtifactHit[] = []
  if (getArtifacts) {
    for (const app of applications) {
      const arts = getArtifacts(app.id)
      for (const artifact of arts) {
        const score = scoreArtifact(artifact, app, query)
        if (score > 0) {
          artHits.push({ kind: 'artifact', artifact, application: app, score })
        }
      }
    }
    artHits.sort((a, b) => b.score - a.score)
  }

  const artifacts = artHits.slice(0, artLimit)

  return {
    query,
    applications: appHits,
    artifacts,
    total: appHits.length + artifacts.length,
  }
}
