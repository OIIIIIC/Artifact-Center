import type { AuthUser } from '@/types/auth'

export type MemberRole = AuthUser['role']

export interface TeamMember {
  id: string
  name: string
  email: string
  role: MemberRole
  avatarUrl?: string | null
}

export const MEMBER_ROLES: MemberRole[] = ['admin', 'maintainer', 'viewer']
