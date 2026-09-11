import { request } from '@/services/http'

/* ── Platform release robots / settings ──────────────── */

export type ReleaseRobotDto = {
  id: string
  name: string
  channels: Array<'beta' | 'stable'>
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export async function apiListReleaseRobots(): Promise<ReleaseRobotDto[]> {
  const data = await request<{ items: ReleaseRobotDto[] }>(
    '/settings/release-credentials',
  )
  return data.items
}

export async function apiCreateReleaseRobot(body: {
  name: string
  expiresAt?: string
}): Promise<{ credential: ReleaseRobotDto; token: string }> {
  return request('/settings/release-credentials', { method: 'POST', body })
}

export async function apiRevokeReleaseRobot(id: string): Promise<void> {
  await request<{ ok: true }>(`/settings/release-credentials/${id}`, {
    method: 'DELETE',
  })
}
