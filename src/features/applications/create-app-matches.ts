import type { Application } from '@/types/application'

const NAME_MIN = 2
const PACKAGE_MIN = 3
const LIMIT = 3

function normalize(s: string) {
  return s.trim().toLowerCase()
}

function nameScore(query: string, name: string): number {
  const q = normalize(query)
  const n = normalize(name)
  if (!q || !n) return 0
  if (n === q) return 100
  if (n.startsWith(q)) return 80
  if (n.includes(q)) return 50
  // loose token: any word of query in name
  const tokens = q.split(/[\s\-_.]+/).filter((t) => t.length >= 2)
  if (tokens.some((t) => n.includes(t))) return 30
  return 0
}

function packageScore(query: string, packageName: string): number {
  const q = normalize(query)
  const p = normalize(packageName)
  if (!q || !p) return 0
  if (p === q) return 100
  if (p.startsWith(q)) return 70
  if (p.includes(q)) return 40
  return 0
}

/** Name similarity for naming reference — soft, never blocks create. */
export function findSimilarByName(
  catalog: Application[],
  query: string,
  limit: number = LIMIT,
): Application[] {
  if (normalize(query).length < NAME_MIN) return []
  return catalog
    .map((app) => ({ app, score: nameScore(query, app.name) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.app.name.localeCompare(b.app.name))
    .slice(0, limit)
    .map((x) => x.app)
}

export type PackageMatchResult = {
  /** 同包名应用，仅作为创建时的参考信息。 */
  exact: Application[]
  /** 相近包名应用（不包含同包名应用）。 */
  similar: Application[]
}

/** 包名匹配仅用于展示参考应用，不影响创建。 */
export function findPackageMatches(
  catalog: Application[],
  query: string,
  limit: number = LIMIT,
): PackageMatchResult {
  const q = normalize(query)
  if (!q) return { exact: [], similar: [] }

  const exact = catalog.filter((a) => normalize(a.packageName) === q)

  if (q.length < PACKAGE_MIN && exact.length === 0) {
    return { exact: [], similar: [] }
  }

  const exactIds = new Set(exact.map((app) => app.id))
  const similar = catalog
    .filter((a) => !exactIds.has(a.id))
    .map((app) => ({ app, score: packageScore(query, app.packageName) }))
    .filter((x) => x.score > 0 && x.score < 100)
    .sort(
      (a, b) => b.score - a.score || a.app.packageName.localeCompare(b.app.packageName),
    )
    .slice(0, limit)
    .map((x) => x.app)

  return { exact, similar }
}
