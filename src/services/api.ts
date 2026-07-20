import { request, requestBlob } from '@/services/http'
import type {
  Application,
  ApplicationPlatform,
  ApplicationStatus,
  Region,
} from '@/types/application'
import type { Artifact, ArtifactStatus } from '@/types/artifact'
import type { Release } from '@/types/release'
import type { AuthUser, LoginCredentials } from '@/types/auth'
import type { UploadChannel } from '@/types/upload'
import { requestMultipart, type UploadProgress } from '@/services/http'

/* ── Auth ─────────────────────────────────────────────── */

type ApiUser = {
  id: string
  username: string
  email: string
  name: string
  role: AuthUser['role']
  avatarUrl?: string | null
}

function mapUser(u: ApiUser): AuthUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl ?? null,
  }
}

export async function apiLogin(credentials: LoginCredentials): Promise<{
  token: string
  user: AuthUser
}> {
  const data = await request<{ token: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: {
      identifier: credentials.identifier.trim(),
      password: credentials.password,
    },
    public: true,
  })
  return { token: data.token, user: mapUser(data.user) }
}

export async function apiMe(): Promise<AuthUser> {
  const data = await request<{ user: ApiUser }>('/auth/me')
  return mapUser(data.user)
}

export type UpdateProfileBody = {
  name?: string
  email?: string
  avatarUrl?: string | null
}

export async function apiUpdateProfile(
  body: UpdateProfileBody,
): Promise<{ user: AuthUser; token: string }> {
  const data = await request<{ user: ApiUser; token: string }>('/auth/me', {
    method: 'PATCH',
    body,
  })
  return { user: mapUser(data.user), token: data.token }
}

export async function apiChangePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  await request<{ ok: true }>('/auth/change-password', {
    method: 'POST',
    body: input,
  })
}

/* ── Audit ────────────────────────────────────────────── */

export type AuditLogItem = {
  id: string
  actorId: string | null
  actorName: string
  action: string
  objectType: string
  objectId: string | null
  applicationId: string | null
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

/* ── Search ───────────────────────────────────────────── */

export type SearchApiResult = {
  query: string
  applications: Application[]
  artifacts: Array<{
    artifact: Artifact
    application: Pick<Application, 'id' | 'name' | 'packageName' | 'platform' | 'region'>
  }>
  total: number
}

export async function apiSearch(
  q: string,
  limits?: { apps?: number; artifacts?: number },
): Promise<SearchApiResult> {
  const sp = new URLSearchParams()
  sp.set('q', q)
  if (limits?.apps) sp.set('apps', String(limits.apps))
  if (limits?.artifacts) sp.set('artifacts', String(limits.artifacts))
  return request<SearchApiResult>(`/search?${sp.toString()}`)
}

/* ── Users (admin) ────────────────────────────────────── */

export type TeamMemberDto = AuthUser & {
  createdAt?: string
  updatedAt?: string
}

type ApiTeamUser = ApiUser & {
  createdAt?: string
  updatedAt?: string
}

function mapTeamUser(u: ApiTeamUser): TeamMemberDto {
  return {
    ...mapUser(u),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }
}

export async function apiListUsers(): Promise<TeamMemberDto[]> {
  const data = await request<{ items: ApiTeamUser[]; total: number }>('/users')
  return data.items.map(mapTeamUser)
}

export type CreateUserBody = {
  name: string
  username: string
  email: string
  password: string
  role: AuthUser['role']
}

export async function apiCreateUser(body: CreateUserBody): Promise<TeamMemberDto> {
  const data = await request<{ user: ApiTeamUser }>('/users', {
    method: 'POST',
    body,
  })
  return mapTeamUser(data.user)
}

export async function apiUpdateUser(
  id: string,
  body: { name?: string; role?: AuthUser['role'] },
): Promise<TeamMemberDto> {
  const data = await request<{ user: ApiTeamUser }>(`/users/${id}`, {
    method: 'PATCH',
    body,
  })
  return mapTeamUser(data.user)
}

export async function apiDeleteUser(id: string): Promise<void> {
  await request<{ ok: true }>(`/users/${id}`, { method: 'DELETE' })
}

export async function apiAdminResetPassword(id: string, password: string): Promise<void> {
  await request<{ ok: true }>(`/users/${id}/reset-password`, {
    method: 'POST',
    body: { password },
  })
}

/* ── Applications ─────────────────────────────────────── */

type ApiApplication = {
  id: string
  name: string
  description: string
  packageName: string
  platform: ApplicationPlatform
  region: Region
  repository: string
  status: ApplicationStatus
  owner: string
  latestVersion: string
  artifactCount: number
  createdAt: string
  updatedAt: string
}

function mapApp(a: ApiApplication): Application {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    packageName: a.packageName,
    platform: a.platform,
    region: a.region,
    repository: a.repository,
    status: a.status,
    owner: a.owner,
    latestVersion: a.latestVersion,
    artifactCount: a.artifactCount,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }
}

export type ListApplicationsParams = {
  q?: string
  platform?: ApplicationPlatform | 'all'
  sort?: 'updated' | 'name' | 'created'
}

export async function apiListApplications(
  params: ListApplicationsParams = {},
): Promise<Application[]> {
  const sp = new URLSearchParams()
  if (params.q?.trim()) sp.set('q', params.q.trim())
  if (params.platform && params.platform !== 'all') {
    sp.set('platform', params.platform)
  }
  if (params.sort) sp.set('sort', params.sort)
  const qs = sp.toString()
  const data = await request<{ items: ApiApplication[]; total: number }>(
    `/applications${qs ? `?${qs}` : ''}`,
  )
  return data.items.map(mapApp)
}

export async function apiGetApplication(id: string): Promise<Application> {
  const data = await request<{ application: ApiApplication }>(`/applications/${id}`)
  return mapApp(data.application)
}

export type CreateApplicationBody = {
  name: string
  description: string
  packageName: string
  platform: ApplicationPlatform
  regionId: string
  repository?: string
}

export async function apiCreateApplication(
  body: CreateApplicationBody,
): Promise<Application> {
  const data = await request<{ application: ApiApplication }>('/applications', {
    method: 'POST',
    body,
  })
  return mapApp(data.application)
}

export type UpdateApplicationBody = {
  name?: string
  description?: string
  packageName?: string
  platform?: ApplicationPlatform
  regionId?: string
  repository?: string
  status?: ApplicationStatus
  ownerName?: string
}

export async function apiUpdateApplication(
  id: string,
  body: UpdateApplicationBody,
): Promise<Application> {
  const data = await request<{ application: ApiApplication }>(`/applications/${id}`, {
    method: 'PATCH',
    body,
  })
  return mapApp(data.application)
}

export async function apiDeleteApplication(id: string): Promise<void> {
  await request<{ ok: true }>(`/applications/${id}`, { method: 'DELETE' })
}

/* ── Regions ──────────────────────────────────────────── */

export async function apiListRegions(): Promise<Region[]> {
  const data = await request<{ items: Region[]; total: number }>('/settings/regions')
  return data.items
}

export type RegionMutationBody = {
  code: string
  name: string
  sortOrder: number
  enabled?: boolean
}

export async function apiCreateRegion(body: RegionMutationBody): Promise<Region> {
  const data = await request<{ region: Region }>('/settings/regions', {
    method: 'POST',
    body,
  })
  return data.region
}

export async function apiUpdateRegion(
  id: string,
  body: Partial<RegionMutationBody>,
): Promise<Region> {
  const data = await request<{ region: Region }>(`/settings/regions/${id}`, {
    method: 'PATCH',
    body,
  })
  return data.region
}

export async function apiDeleteRegion(id: string): Promise<void> {
  await request<{ ok: true }>(`/settings/regions/${id}`, { method: 'DELETE' })
}

export type ApplicationMemberDto = {
  id: string
  name: string
  email: string
  role: 'maintainer' | 'viewer'
  platformRole: 'admin' | 'maintainer' | 'viewer'
  isOwner: boolean
  joinedAt: string
}

export type ApplicationMemberCandidateDto = {
  id: string
  name: string
  email: string
  platformRole: 'maintainer' | 'viewer'
}

export async function apiListApplicationMembers(
  applicationId: string,
): Promise<ApplicationMemberDto[]> {
  const data = await request<{ items: ApplicationMemberDto[] }>(
    `/applications/${applicationId}/members`,
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

/* ── Artifacts ────────────────────────────────────────── */

type ApiArtifact = {
  id: string
  applicationId: string
  releaseId?: string
  version: string
  buildNumber: string
  platform: ApplicationPlatform
  type?: Artifact['type']
  channel: UploadChannel
  status: ArtifactStatus
  filename: string
  sizeBytes: number
  sha256?: string | null
  releaseNotes: string
  uploader: string
  uploadedAt: string
  parsedMeta?: Record<string, unknown> | null
  buildMeta?: Record<string, unknown> | null
}

function mapArtifact(a: ApiArtifact): Artifact {
  return {
    id: a.id,
    applicationId: a.applicationId,
    releaseId: a.releaseId,
    version: a.version,
    buildNumber: a.buildNumber,
    platform: a.platform,
    type: a.type,
    channel: a.channel,
    status: a.status,
    filename: a.filename,
    sizeBytes: a.sizeBytes,
    sha256: a.sha256 ?? undefined,
    releaseNotes: a.releaseNotes,
    uploader: a.uploader,
    uploadedAt: a.uploadedAt,
    parsedMeta: a.parsedMeta,
    buildMeta: a.buildMeta,
  }
}

export async function apiListArtifacts(appId: string): Promise<Artifact[]> {
  const data = await request<{ items: ApiArtifact[] }>(`/applications/${appId}/artifacts`)
  return data.items.map(mapArtifact)
}

export async function apiListReleases(appId: string): Promise<Release[]> {
  const data = await request<{ items: Release[] }>(`/applications/${appId}/releases`)
  return data.items
}

export async function apiGetArtifact(id: string): Promise<Artifact> {
  const data = await request<{ artifact: ApiArtifact }>(`/artifacts/${id}`)
  return mapArtifact(data.artifact)
}

export type UpdateArtifactBody = {
  channel?: UploadChannel
  status?: ArtifactStatus
  releaseNotes?: string
  markLatest?: boolean
}

export async function apiUpdateArtifact(
  id: string,
  body: UpdateArtifactBody,
): Promise<Artifact> {
  const data = await request<{ artifact: ApiArtifact }>(`/artifacts/${id}`, {
    method: 'PATCH',
    body,
  })
  return mapArtifact(data.artifact)
}

export async function apiDeleteArtifact(id: string): Promise<void> {
  await request<{ ok: true }>(`/artifacts/${id}`, { method: 'DELETE' })
}

export type UploadArtifactFields = {
  version: string
  buildNumber?: string
  channel?: UploadChannel
  platform?: ApplicationPlatform
  releaseNotes?: string
  markLatest?: boolean
}

export async function apiUploadArtifact(
  appId: string,
  file: File,
  fields: UploadArtifactFields,
  onProgress?: UploadProgress,
): Promise<Artifact> {
  const form = new FormData()
  form.append('file', file)
  form.append('version', fields.version)
  if (fields.buildNumber) form.append('buildNumber', fields.buildNumber)
  if (fields.channel) form.append('channel', fields.channel)
  if (fields.platform) form.append('platform', fields.platform)
  if (fields.releaseNotes != null) form.append('releaseNotes', fields.releaseNotes)
  form.append('markLatest', fields.markLatest === false ? 'false' : 'true')

  const artifact = await requestMultipart<ApiArtifact>(
    `/applications/${appId}/artifacts`,
    form,
    onProgress,
  )
  return mapArtifact(artifact)
}

export async function apiDownloadArtifact(
  id: string,
): Promise<{ blob: Blob; filename?: string }> {
  return requestBlob(`/artifacts/${id}/download`)
}

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

/* ── Diagnostics / settings ───────────────────────────── */

export type DiagnosticReportInput = {
  sinceMinutes: 15 | 30 | 60
  requestId?: string
  operation?: string
  expected?: string
  actual?: string
  occurredAt?: string
  client?: {
    page?: string
    browser?: string
    timezone?: string
  }
}

export type DiagnosticReportDto = {
  generatedAt: string
  eventCount: number
  markdown: string
}

export async function apiGenerateDiagnosticReport(
  body: DiagnosticReportInput,
): Promise<DiagnosticReportDto> {
  const data = await request<{ report: DiagnosticReportDto }>(
    '/settings/diagnostics/report',
    { method: 'POST', body },
  )
  return data.report
}

/* ── Shares (server-issued) ───────────────────────────── */

export type ShareLinkDto = {
  id: string
  token: string
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
    token: string
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
