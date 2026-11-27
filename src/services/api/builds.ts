import { API_BASE_URL, request } from '@/services/http'

export type BuildState =
  | 'pending'
  | 'submitting'
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'
  | 'unstable'
  | 'aborted'
  | 'unknown'
export type BuildFile = {
  fileName: string
  relativePath: string
  targetApplicationId?: string | null
  targetName?: string
  targetError?: string | null
}
export type BuildRun = {
  id: string
  applicationId: string
  requestedByName: string
  jobPath: string
  parameters: Array<{ name: string; value: string }>
  status: BuildState
  queueId: number | null
  buildNumber: number | null
  commits: string[]
  files: BuildFile[]
  error: string | null
  cancelRequestedAt: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  updatedAt: string
}
export type BuildPublication = {
  targetApplicationId?: string | null
  id: string
  buildId: string
  relativePath: string
  version: string
  channel: 'beta' | 'stable'
  releaseNotes: string
  status: 'pending' | 'importing' | 'published' | 'failed'
  artifactId: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}
export type BuildDetail = { build: BuildRun; publications: BuildPublication[] }
export const buildKeys = {
  all: (appId: string) => ['builds', appId] as const,
  list: (appId: string, before: string | null) =>
    ['builds', appId, 'list', before] as const,
  detail: (appId: string, id: string) => ['builds', appId, 'detail', id] as const,
}
const prefix = (appId: string) => `/applications/${encodeURIComponent(appId)}/builds`
export const apiListBuilds = (appId: string, before: string | null) =>
  request<{ items: BuildRun[]; nextCursor: string | null }>(
    `${prefix(appId)}${before ? `?before=${encodeURIComponent(before)}` : ''}`,
  )
export const apiGetBuild = (appId: string, id: string) =>
  request<BuildDetail>(`${prefix(appId)}/${encodeURIComponent(id)}`)
export const apiStartBuild = (
  appId: string,
  body: {
    requestKey: string
    configRevision: number
    parameters: BuildRun['parameters']
    acknowledgeUnknown: boolean
  },
) => request<{ build: BuildRun }>(prefix(appId), { method: 'POST', body })
export const apiCancelBuild = (appId: string, id: string) =>
  request<{ build: BuildRun }>(`${prefix(appId)}/${id}/cancel`, { method: 'POST' })
export const apiBuildLog = (
  appId: string,
  id: string,
  start: number,
  signal?: AbortSignal,
) =>
  request<{ text: string; nextStart: number; more: boolean; truncated: boolean }>(
    `${prefix(appId)}/${id}/log?start=${start}`,
    { signal },
  )
export async function apiBuildDownload(appId: string, id: string, relativePath: string) {
  const { url } = await request<{ url: string }>(
    `${prefix(appId)}/${id}/download-ticket`,
    { method: 'POST', body: { relativePath } },
  )
  return `${API_BASE_URL}${url}`
}
export const apiPublishBuild = (
  appId: string,
  id: string,
  body: {
    relativePath: string
    version: string
    channel: 'beta' | 'stable'
    releaseNotes: string
    confirmStable: boolean
  },
) =>
  request<{ publication: BuildPublication }>(`${prefix(appId)}/${id}/publications`, {
    method: 'POST',
    body,
  })
