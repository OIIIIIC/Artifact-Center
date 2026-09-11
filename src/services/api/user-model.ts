import type { AuthUser } from '@/types/auth'

export type ApiUser = {
  id: string
  username: string
  email: string
  name: string
  role: AuthUser['role']
  avatarUrl?: string | null
}

export function mapUser(u: ApiUser): AuthUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl ?? null,
  }
}
