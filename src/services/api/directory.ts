import { request } from '@/services/http'
import type { Project, Region } from '@/types/application'

/* ── Regions ──────────────────────────────────────────── */

export async function apiListProjects(): Promise<Project[]> {
  const data = await request<{ items: Project[] }>('/settings/projects')
  return data.items
}

export type ProjectMutationBody = {
  name: string
  code?: string | null
  sortOrder?: number
  enabled?: boolean
}

export async function apiCreateProject(
  productId: string,
  body: ProjectMutationBody,
): Promise<Project> {
  const data = await request<{ project: Project }>('/settings/projects', {
    method: 'POST',
    body: { ...body, productId },
  })
  return data.project
}

export async function apiUpdateProject(
  id: string,
  body: Partial<ProjectMutationBody>,
): Promise<Project> {
  const data = await request<{ project: Project }>(`/settings/projects/${id}`, {
    method: 'PATCH',
    body,
  })
  return data.project
}

export async function apiDeleteProject(id: string): Promise<void> {
  await request(`/settings/projects/${id}`, { method: 'DELETE' })
}

export async function apiReorderProjects(
  productId: string,
  projectIds: string[],
  expectedOrder: string[],
): Promise<Project[]> {
  const data = await request<{ items: Project[] }>('/settings/projects/order', {
    method: 'PUT',
    body: { productId, projectIds, expectedOrder },
  })
  return data.items
}

export async function apiListRegions(): Promise<Region[]> {
  const data = await request<{ items: Region[]; total: number }>('/settings/regions')
  return data.items
}

export type RegionMutationBody = {
  code: string
  name: string
  sortOrder: number
  enabled?: boolean
}

export async function apiCreateRegion(body: RegionMutationBody): Promise<Region> {
  const data = await request<{ region: Region }>('/settings/regions', {
    method: 'POST',
    body,
  })
  return data.region
}

export async function apiUpdateRegion(
  id: string,
  body: Partial<RegionMutationBody>,
): Promise<Region> {
  const data = await request<{ region: Region }>(`/settings/regions/${id}`, {
    method: 'PATCH',
    body,
  })
  return data.region
}

export async function apiDeleteRegion(id: string): Promise<void> {
  await request<{ ok: true }>(`/settings/regions/${id}`, { method: 'DELETE' })
}
