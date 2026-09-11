import { request } from '@/services/http'

export type ApplicationMemberDto = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: 'maintainer' | 'viewer'
  platformRole: 'admin' | 'maintainer' | 'viewer'
  isOwner: boolean
  joinedAt: string
}

export type ApplicationMemberCandidateDto = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  platformRole: 'maintainer' | 'viewer'
}

/** 当前账户在各应用中的显式成员关系，供管理员批量配置权限。 */
export type ApplicationAccessGrantDto = {
  applicationId: string
  role: 'maintainer' | 'viewer'
  isOwner: boolean
}

export async function apiListApplicationMembers(
  applicationId: string,
): Promise<ApplicationMemberDto[]> {
  const data = await request<{ items: ApplicationMemberDto[] }>(
    `/applications/${applicationId}/members`,
  )
  return data.items
}

export async function apiListApplicationAccess(
  userId: string,
): Promise<ApplicationAccessGrantDto[]> {
  const data = await request<{ items: ApplicationAccessGrantDto[] }>(
    `/settings/access-grants/${userId}`,
  )
  return data.items
}

export async function apiUpsertApplicationMember(
  applicationId: string,
  userId: string,
  role: ApplicationMemberDto['role'],
): Promise<void> {
  await request(`/applications/${applicationId}/members/${userId}`, {
    method: 'PUT',
    body: { role },
  })
}

export async function apiListApplicationMemberCandidates(
  applicationId: string,
  q = '',
): Promise<ApplicationMemberCandidateDto[]> {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  const suffix = params.toString()
  const data = await request<{ items: ApplicationMemberCandidateDto[] }>(
    `/applications/${applicationId}/member-candidates${suffix ? `?${suffix}` : ''}`,
  )
  return data.items
}

export async function apiRemoveApplicationMember(
  applicationId: string,
  userId: string,
): Promise<void> {
  await request(`/applications/${applicationId}/members/${userId}`, { method: 'DELETE' })
}

export async function apiBatchUpdateApplicationAccess(
  input:
    | {
        userId: string
        applicationIds: string[]
        operation: 'set'
        role: 'maintainer' | 'viewer'
      }
    | {
        userId: string
        applicationIds: string[]
        operation: 'remove'
      },
): Promise<{ ok: true; affected: number }> {
  return request('/settings/access-grants', { method: 'POST', body: input })
}
