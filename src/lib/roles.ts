import type { AuthUser } from '@/types/auth'
import type { ApplicationAccessRole } from '@/types/application'

export type AppRole = AuthUser['role']

/** Can create apps, upload artifacts, edit app metadata */
export function canWriteContent(role: AppRole | undefined | null): boolean {
  return role === 'admin' || role === 'maintainer'
}

/** 应用操作只由当前应用的有效角色决定；平台管理员始终拥有全部应用权限。 */
export function canMaintainApplication(
  platformRole: AppRole | undefined | null,
  accessRole: ApplicationAccessRole | undefined | null,
): boolean {
  return platformRole === 'admin' || accessRole === 'admin' || accessRole === 'maintainer'
}

/** Can delete applications */
export function canDeleteApplication(role: AppRole | undefined | null): boolean {
  return role === 'admin'
}

/** Can manage members / global settings that are admin-only */
export function canManageMembers(role: AppRole | undefined | null): boolean {
  return role === 'admin'
}
