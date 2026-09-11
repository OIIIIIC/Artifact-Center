import { request } from '@/services/http'
import type { ApplicationPlatform } from '@/types/application'

export type PersonalWorkspacePreferences = {
  projectId?: string | null
  platform: ApplicationPlatform | 'all'
  sort: 'updated' | 'name' | 'created'
  regionId: string | null
  query: string
  favoriteOnly: boolean
  responsibleOnly: boolean
  collapsed: boolean
}

export type PersonalWorkspace = {
  favoriteApplicationIds: string[]
  recentApplications: Array<{ applicationId: string; viewedAt: string }>
  preferences: PersonalWorkspacePreferences
}

export async function apiGetPersonalWorkspace(
  signal?: AbortSignal,
): Promise<PersonalWorkspace> {
  return request<PersonalWorkspace>('/workspace', { signal })
}

export async function apiSetApplicationFavorite(
  applicationId: string,
  favorite: boolean,
  restoreOrder = false,
): Promise<boolean> {
  const data = await request<{ favorite: boolean }>(
    `/workspace/favorites/${applicationId}`,
    {
      method: 'PUT',
      body: { favorite, ...(restoreOrder ? { restoreOrder: true } : {}) },
    },
  )
  return data.favorite
}

export async function apiRecordApplicationVisit(applicationId: string): Promise<void> {
  await request<{ viewedAt: string }>(`/workspace/visits/${applicationId}`, {
    method: 'POST',
  })
}

export async function apiUpdatePersonalWorkspacePreferences(
  preferences: Partial<PersonalWorkspacePreferences>,
): Promise<PersonalWorkspacePreferences> {
  const data = await request<{ preferences: PersonalWorkspacePreferences }>(
    '/workspace/preferences',
    { method: 'PUT', body: preferences },
  )
  return data.preferences
}
