import { request } from '@/services/http'
import type { AuthUser } from '@/types/auth'
import type { ApiUser } from './user-model'
import { mapUser } from './user-model'

/* ── Users (admin) ────────────────────────────────────── */

export type TeamMemberDto = AuthUser & {
  createdAt?: string
  updatedAt?: string
}

type ApiTeamUser = ApiUser & {
  createdAt?: string
  updatedAt?: string
}

function mapTeamUser(u: ApiTeamUser): TeamMemberDto {
  return {
    ...mapUser(u),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }
}

export async function apiListUsers(): Promise<TeamMemberDto[]> {
  const data = await request<{ items: ApiTeamUser[]; total: number }>('/users')
  return data.items.map(mapTeamUser)
}

export type CreateUserBody = {
  name: string
  username: string
  email: string
  password: string
  role: AuthUser['role']
}

export async function apiCreateUser(body: CreateUserBody): Promise<TeamMemberDto> {
  const data = await request<{ user: ApiTeamUser }>('/users', {
    method: 'POST',
    body,
  })
  return mapTeamUser(data.user)
}

export async function apiUpdateUser(
  id: string,
  body: { name?: string; role?: AuthUser['role'] },
): Promise<TeamMemberDto> {
  const data = await request<{ user: ApiTeamUser }>(`/users/${id}`, {
    method: 'PATCH',
    body,
  })
  return mapTeamUser(data.user)
}

export async function apiTransferAdministrator(input: {
  targetUserId: string
  nextRole: 'maintainer' | 'viewer'
}): Promise<void> {
  await request<{ user: ApiTeamUser; target: ApiTeamUser }>('/users/me/transfer-admin', {
    method: 'POST',
    body: input,
  })
}

export async function apiDeleteUser(id: string): Promise<void> {
  await request<{ ok: true }>(`/users/${id}`, { method: 'DELETE' })
}

export async function apiAdminResetPassword(id: string, password: string): Promise<void> {
  await request<{ ok: true }>(`/users/${id}/reset-password`, {
    method: 'POST',
    body: { password },
  })
}
