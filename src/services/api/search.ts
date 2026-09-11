import { request } from '@/services/http'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'

/* ── Search ───────────────────────────────────────────── */

export type SearchApiResult = {
  query: string
  applications: Application[]
  artifacts: Array<{
    artifact: Artifact
    application: Pick<
      Application,
      'id' | 'name' | 'applicationCode' | 'packageName' | 'platform' | 'region'
    >
  }>
  total: number
}

export async function apiSearch(
  q: string,
  limits?: { apps?: number; artifacts?: number },
): Promise<SearchApiResult> {
  const sp = new URLSearchParams()
  sp.set('q', q)
  if (limits?.apps) sp.set('apps', String(limits.apps))
  if (limits?.artifacts) sp.set('artifacts', String(limits.artifacts))
  return request<SearchApiResult>(`/search?${sp.toString()}`)
}
