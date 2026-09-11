import { request } from '@/services/http'
import type { AuthUser, LoginCredentials } from '@/types/auth'
import type { ApiUser } from './user-model'
import { mapUser } from './user-model'

export async function apiLogin(credentials: LoginCredentials): Promise<{
  token: string
  user: AuthUser
}> {
  const data = await request<{ token: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: {
      identifier: credentials.identifier.trim(),
      password: credentials.password,
    },
    public: true,
  })
  return { token: data.token, user: mapUser(data.user) }
}

export async function apiMe(): Promise<AuthUser> {
  const data = await request<{ user: ApiUser }>('/auth/me')
  return mapUser(data.user)
}

export type UpdateProfileBody = {
  name?: string
  email?: string
  avatarUrl?: string | null
}

export async function apiUpdateProfile(
  body: UpdateProfileBody,
): Promise<{ user: AuthUser; token: string }> {
  const data = await request<{ user: ApiUser; token: string }>('/auth/me', {
    method: 'PATCH',
    body,
  })
  return { user: mapUser(data.user), token: data.token }
}

export async function apiChangePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ token: string }> {
  const data = await request<{ ok: true; token: string }>('/auth/change-password', {
    method: 'POST',
    body: input,
  })
  return { token: data.token }
}
