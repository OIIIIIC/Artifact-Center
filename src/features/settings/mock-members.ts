import type { AuthUser } from '@/types/auth'

export type MemberRole = AuthUser['role']

export interface TeamMember {
  id: string
  name: string
  email: string
  role: MemberRole
}

/** Seed members for Settings → Members (mock, no backend). */
export const SEED_MEMBERS: TeamMember[] = [
  {
    id: 'm-1',
    name: 'Demo User',
    email: 'demo@enterprise.local',
    role: 'admin',
  },
  {
    id: 'm-2',
    name: 'Li Wei',
    email: 'li.wei@enterprise.local',
    role: 'maintainer',
  },
  {
    id: 'm-3',
    name: 'Chen Na',
    email: 'chen.na@enterprise.local',
    role: 'maintainer',
  },
  {
    id: 'm-4',
    name: 'Wang Jun',
    email: 'wang.jun@enterprise.local',
    role: 'viewer',
  },
]

export const MEMBER_ROLES: MemberRole[] = ['admin', 'maintainer', 'viewer']
