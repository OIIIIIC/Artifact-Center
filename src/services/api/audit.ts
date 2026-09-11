import { request } from '@/services/http'

/* ── Audit ────────────────────────────────────────────── */

export type AuditLogItem = {
  id: string
  actorId: string | null
  actorName: string
  action: string
  objectType: string
  objectId: string | null
  applicationId: string | null
  applicationName: string | null
  summary: string
  meta: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export type PageResult<T> = { items: T[]; nextOffset: number | null }

export async function apiListAudit(params?: {
  applicationId?: string
  limit?: number
  offset?: number
}): Promise<PageResult<AuditLogItem>> {
  const sp = new URLSearchParams()
  if (params?.applicationId) sp.set('applicationId', params.applicationId)
  if (params?.limit) sp.set('limit', String(params.limit))
  if (params?.offset) sp.set('offset', String(params.offset))
  const qs = sp.toString()
  return request<PageResult<AuditLogItem>>(`/audit${qs ? `?${qs}` : ''}`)
}
