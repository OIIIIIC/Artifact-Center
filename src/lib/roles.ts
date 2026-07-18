import type { AuthUser } from '@/types/auth'

export type AppRole = AuthUser['role']

/** Can create apps, upload artifacts, edit app metadata */
export function canWriteContent(role: AppRole | undefined | null): boolean {
  return role === 'admin' || role === 'maintainer'
}

/** Can delete applications */
export function canDeleteApplication(role: AppRole | undefined | null): boolean {
  return role === 'admin'
}

/** Can manage members / global settings that are admin-only */
export function canManageMembers(role: AppRole | undefined | null): boolean {
  return role === 'admin'
}
