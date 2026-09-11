import { API_BASE_URL, request, requestBlob } from '@/services/http'
import type { Application, Region } from '@/types/application'
import type { Artifact } from '@/types/artifact'

/* ── Shares (server-issued) ───────────────────────────── */

export type ShareLinkDto = {
  id: string
  /** 仅创建响应返回明文；列表/吊销为空，不可用于再次复制。 */
  token: string
  /** 展示用短前缀，不可鉴权。 */
  tokenPrefix?: string
  kind: 'single' | 'collection'
  title: string
  regionId: string | null
  applicationId: string
  mode: 'latest' | 'artifact'
  artifactId: string | null
  /** 当前应用在该分享条目中的模式；集合分享可能与根记录不同。 */
  itemMode: 'latest' | 'artifact'
  /** 固定版本对应的可读版本号。 */
  artifactVersion: string | null
  createdBy: string
  createdById?: string | null
  createdAt: string
  expiresAt: string | null
  revokedAt?: string | null
  downloadCount?: number
  itemCount: number
}

export async function apiCreateShare(
  applicationId: string,
  body: {
    mode: 'latest' | 'artifact'
    artifactId?: string
    expiresInDays?: number
  },
): Promise<ShareLinkDto> {
  const data = await request<{ share: ShareLinkDto }>(
    `/applications/${applicationId}/shares`,
    { method: 'POST', body },
  )
  return data.share
}

export async function apiCreateShareCollection(body: {
  title: string
  regionId: string
  items: Array<{
    applicationId: string
    mode: 'latest' | 'artifact'
    artifactId?: string
  }>
  expiresInDays?: number
}): Promise<ShareLinkDto> {
  const data = await request<{ share: ShareLinkDto }>('/shares', {
    method: 'POST',
    body,
  })
  return data.share
}

export async function apiListShares(applicationId: string): Promise<ShareLinkDto[]> {
  const data = await request<{ items: ShareLinkDto[]; total: number }>(
    `/applications/${applicationId}/shares`,
  )
  return data.items
}

export async function apiRevokeShare(id: string): Promise<ShareLinkDto> {
  const data = await request<{ share: ShareLinkDto }>(`/shares/${id}`, {
    method: 'DELETE',
  })
  return data.share
}

export type PublicShareResolve = {
  ok: true
  share: {
    id: string
    kind: 'single' | 'collection'
    title: string
    regionId: string | null
    createdBy: string
    expiresAt: string | null
    createdAt: string
    downloadCount: number
  }
  region: Region | null
  items: Array<{
    id: string
    mode: 'latest' | 'artifact'
    downloadCount: number
    available: boolean
    unavailableReason: 'artifact_missing' | null
    application: Application
    artifact: Artifact | null
  }>
}

export async function apiResolveShare(token: string): Promise<PublicShareResolve> {
  return request<PublicShareResolve>(`/public/shares/${encodeURIComponent(token)}`, {
    public: true,
  })
}

export async function apiDownloadShare(
  token: string,
  itemId?: string,
): Promise<{ blob: Blob; filename?: string }> {
  const itemPath = itemId ? `/items/${encodeURIComponent(itemId)}` : ''
  return requestBlob(`/public/shares/${encodeURIComponent(token)}${itemPath}/download`, {
    public: true,
  })
}

export function apiShareDownloadUrl(token: string, itemId?: string): string {
  const itemPath = itemId ? `/items/${encodeURIComponent(itemId)}` : ''
  return `${API_BASE_URL}/public/shares/${encodeURIComponent(token)}${itemPath}/download`
}
