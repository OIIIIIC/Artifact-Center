import { request } from '@/services/http'
import type {
  Application,
  ApplicationIconColor,
  ApplicationIconKey,
  ApplicationPlatform,
  ApplicationStatus,
  Region,
} from '@/types/application'
import type { Artifact } from '@/types/artifact'
import type { Release } from '@/types/release'
import type { ApiArtifact } from './artifact-model'
import { mapArtifact } from './artifact-model'

/* ── Applications ─────────────────────────────────────── */

type ApiApplication = {
  id: string
  name: string
  applicationCode: string
  iconKey: ApplicationIconKey
  iconColor: ApplicationIconColor
  description: string
  packageName: string
  platform: ApplicationPlatform
  region: Region
  projectName?: string
  projectId?: string
  repository: string
  status: ApplicationStatus
  owner: string
  accessRole?: Application['accessRole']
  members?: Array<{
    id: string
    name: string
    avatarUrl: string | null
  }>
  latestVersion: string
  artifactCount: number
  latestArtifactUploadedAt?: string | null
  createdAt: string
  updatedAt: string
}

function mapApp(a: ApiApplication): Application {
  return {
    id: a.id,
    name: a.name,
    applicationCode: a.applicationCode,
    iconKey: a.iconKey,
    iconColor: a.iconColor,
    description: a.description,
    packageName: a.packageName,
    platform: a.platform,
    region: a.region,
    projectId: a.projectId,
    projectName: a.projectName,
    repository: a.repository,
    status: a.status,
    owner: a.owner,
    accessRole: a.accessRole,
    members: a.members,
    latestVersion: a.latestVersion,
    artifactCount: a.artifactCount,
    latestArtifactUploadedAt: a.latestArtifactUploadedAt ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }
}

export type ListApplicationsParams = {
  q?: string
  platform?: ApplicationPlatform | 'all'
  sort?: 'updated' | 'name' | 'created'
}

export async function apiListApplications(
  params: ListApplicationsParams = {},
  signal?: AbortSignal,
): Promise<Application[]> {
  const sp = new URLSearchParams()
  if (params.q?.trim()) sp.set('q', params.q.trim())
  if (params.platform && params.platform !== 'all') {
    sp.set('platform', params.platform)
  }
  if (params.sort) sp.set('sort', params.sort)
  const qs = sp.toString()
  const data = await request<{ items: ApiApplication[]; total: number }>(
    `/applications${qs ? `?${qs}` : ''}`,
    { signal },
  )
  return data.items.map(mapApp)
}

export interface CollectionPage<T> {
  items: T[]
  total: number
  nextCursor: string | null
}

export interface DirectorySummary {
  total: number
  productCounts: Record<string, number>
  projectCounts: Record<string, number>
  maintainableCounts: Record<string, number>
}

export function apiDirectorySummary(signal?: AbortSignal): Promise<DirectorySummary> {
  return request('/applications/summary', { signal })
}

export type ApplicationPageParams = ListApplicationsParams & {
  product?: string
  project?: string
  scope?: string
  favorites?: string
  limit?: number
  cursor?: string
}

export async function apiApplicationPage(
  params: ApplicationPageParams,
  signal?: AbortSignal,
): Promise<CollectionPage<Application>> {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...params, limit: params.limit ?? 24 })) {
    if (value !== undefined && value !== '' && value !== 'all') sp.set(key, String(value))
  }
  const data = await request<CollectionPage<ApiApplication>>(`/applications?${sp}`, {
    signal,
  })
  return { ...data, items: data.items.map(mapApp) }
}

export async function apiApplicationOverview(id: string, signal?: AbortSignal) {
  const data = await request<{ latest: ApiArtifact | null; recent: ApiArtifact[] }>(
    `/applications/${id}/overview`,
    { signal },
  )
  return {
    latest: data.latest ? mapArtifact(data.latest) : undefined,
    recent: data.recent.map(mapArtifact),
  }
}

export async function apiArtifactPage(
  id: string,
  params: { limit?: number; cursor?: string; q?: string },
  signal?: AbortSignal,
): Promise<CollectionPage<Artifact>> {
  const sp = new URLSearchParams({ limit: String(params.limit ?? 30) })
  if (params.cursor) sp.set('cursor', params.cursor)
  if (params.q) sp.set('q', params.q)
  const data = await request<CollectionPage<ApiArtifact>>(
    `/applications/${id}/artifacts?${sp}`,
    { signal },
  )
  return { ...data, items: data.items.map(mapArtifact) }
}

export async function apiReleasePage(
  id: string,
  params: { limit?: number; cursor?: string; q?: string },
  signal?: AbortSignal,
): Promise<CollectionPage<Release>> {
  const sp = new URLSearchParams({ limit: String(params.limit ?? 20) })
  if (params.cursor) sp.set('cursor', params.cursor)
  if (params.q) sp.set('q', params.q)
  return request(`/applications/${id}/releases?${sp}`, { signal })
}

export async function apiGetApplication(id: string): Promise<Application> {
  const data = await request<{ application: ApiApplication }>(`/applications/${id}`)
  return mapApp(data.application)
}

export type CreateApplicationBody = {
  projectId?: string
  name: string
  applicationCode: string
  description: string
  packageName: string
  platform: ApplicationPlatform
  regionId: string
  repository?: string
}

export async function apiCreateApplication(
  body: CreateApplicationBody,
): Promise<Application> {
  const data = await request<{ application: ApiApplication }>('/applications', {
    method: 'POST',
    body,
  })
  return mapApp(data.application)
}

export type UpdateApplicationBody = {
  projectId?: string
  name?: string
  applicationCode?: string
  iconKey?: ApplicationIconKey
  iconColor?: ApplicationIconColor
  description?: string
  packageName?: string
  platform?: ApplicationPlatform
  regionId?: string
  repository?: string
  status?: ApplicationStatus
  ownerName?: string
}

export async function apiUpdateApplication(
  id: string,
  body: UpdateApplicationBody,
): Promise<Application> {
  const data = await request<{ application: ApiApplication }>(`/applications/${id}`, {
    method: 'PATCH',
    body,
  })
  return mapApp(data.application)
}

export async function apiBulkUpdateApplicationCodes(
  updates: Array<{ id: string; applicationCode: string }>,
): Promise<number> {
  const data = await request<{ updated: number }>('/applications/bulk-codes', {
    method: 'PATCH',
    body: { updates },
  })
  return data.updated
}

export async function apiBulkUpdateApplicationAppearance(body: {
  applicationIds: string[]
  iconKey?: ApplicationIconKey
  iconColor?: ApplicationIconColor
}): Promise<number> {
  const data = await request<{ updated: number }>('/applications/bulk-appearance', {
    method: 'PATCH',
    body,
  })
  return data.updated
}

export async function apiDeleteApplication(id: string): Promise<void> {
  await request<{ ok: true }>(`/applications/${id}`, { method: 'DELETE' })
}
