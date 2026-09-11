import { request } from '@/services/http'

/* ── Retention / settings ─────────────────────────────── */

export type RetentionPolicyDto = {
  maxVersions: number
  archiveDeprecatedDays: number
  artifactStorageBytes: number
  diskTotalBytes: number | null
  diskUsedBytes: number | null
  diskFreeBytes: number | null
  measuredAt: string
  updatedAt: string
}

export async function apiGetRetention(): Promise<RetentionPolicyDto> {
  const data = await request<{ retention: RetentionPolicyDto }>('/settings/retention')
  return data.retention
}

export async function apiUpdateRetention(body: {
  maxVersions?: number
  archiveDeprecatedDays?: number
}): Promise<RetentionPolicyDto> {
  const data = await request<{ retention: RetentionPolicyDto }>('/settings/retention', {
    method: 'PATCH',
    body,
  })
  return data.retention
}

export type RetentionCleanupReport = {
  deletedVersions: number
  archivedDeprecated: number
  applicationsTouched: number
}

export async function apiRunRetentionCleanup(): Promise<{
  report: RetentionCleanupReport
  retention: RetentionPolicyDto
}> {
  return request('/settings/retention/run', { method: 'POST' })
}
