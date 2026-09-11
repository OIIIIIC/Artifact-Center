import { API_BASE_URL, request } from '@/services/http'
import type { Artifact, ArtifactStatus } from '@/types/artifact'
import type { Release } from '@/types/release'
import type { UploadChannel } from '@/types/upload'
import type { ApiArtifact } from './artifact-model'
import { mapArtifact } from './artifact-model'

export async function apiListArtifacts(appId: string): Promise<Artifact[]> {
  const data = await request<{ items: ApiArtifact[] }>(`/applications/${appId}/artifacts`)
  return data.items.map(mapArtifact)
}

export async function apiListReleases(appId: string): Promise<Release[]> {
  const data = await request<{ items: Release[] }>(`/applications/${appId}/releases`)
  return data.items
}

export async function apiUpdateReleaseNotes(
  appId: string,
  releaseId: string,
  releaseNotes: string,
): Promise<void> {
  await request<{ ok: true }>(`/applications/${appId}/releases/${releaseId}`, {
    method: 'PATCH',
    body: { releaseNotes },
  })
}

export async function apiGetArtifact(id: string): Promise<Artifact> {
  const data = await request<{ artifact: ApiArtifact }>(`/artifacts/${id}`)
  return mapArtifact(data.artifact)
}

export type UpdateArtifactBody = {
  channel?: UploadChannel
  status?: ArtifactStatus
  releaseNotes?: string
  markLatest?: boolean
}

export async function apiUpdateArtifact(
  id: string,
  body: UpdateArtifactBody,
): Promise<Artifact> {
  const data = await request<{ artifact: ApiArtifact }>(`/artifacts/${id}`, {
    method: 'PATCH',
    body,
  })
  return mapArtifact(data.artifact)
}

export async function apiDeleteArtifact(id: string): Promise<void> {
  await request<{ ok: true }>(`/artifacts/${id}`, { method: 'DELETE' })
}

export async function apiCreateArtifactDownloadUrl(id: string): Promise<string> {
  const data = await request<{ url: string }>(`/artifacts/${id}/download-ticket`, {
    method: 'POST',
  })
  return `${API_BASE_URL}${data.url}`
}
