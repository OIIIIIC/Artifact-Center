import type { AuthUser } from '@/types/auth'

export type MemberRole = AuthUser['role']

export const MEMBER_ROLES: MemberRole[] = ['admin', 'maintainer', 'viewer']
