import { request, requestBlob } from '@/services/http'
import type {
  Application,
  ApplicationPlatform,
  ApplicationStatus,
} from '@/types/application'
import type { Artifact, ArtifactStatus } from '@/types/artifact'
import type { AuthUser, LoginCredentials } from '@/types/auth'
import type { UploadChannel } from '@/types/upload'

/* ── Auth ─────────────────────────────────────────────── */

type ApiUser = {
  id: string
  email: string
  name: string
  role: AuthUser['role']
  avatarUrl?: string | null
}

function mapUser(u: ApiUser): AuthUser {
  return {
    id: u.id,
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
      email: credentials.email.trim(),
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

export async function apiListAudit(params?: {
  applicationId?: string
  limit?: number
}): Promise<AuditLogItem[]> {
  const sp = new URLSearchParams()
  if (params?.applicationId) sp.set('applicationId', params.applicationId)
  if (params?.limit) sp.set('limit', String(params.limit))
  const qs = sp.toString()
  const data = await request<{ items: AuditLogItem[]; total: number }>(
    `/audit${qs ? `?${qs}` : ''}`,
  )
  return data.items
}

/* ── Search ───────────────────────────────────────────── */

export type SearchApiResult = {
  query: string
  applications: Application[]
  artifacts: Array<{
    artifact: Artifact
    application: Pick<Application, 'id' | 'name' | 'packageName' | 'platform'>
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

/* ── Artifacts ────────────────────────────────────────── */

type ApiArtifact = {
  id: string
  applicationId: string
  version: string
  buildNumber: string
  platform: ApplicationPlatform
  channel: UploadChannel
  status: ArtifactStatus
  filename: string
  sizeBytes: number
  sha256?: string | null
  releaseNotes: string
  uploader: string
  uploadedAt: string
}

function mapArtifact(a: ApiArtifact): Artifact {
  return {
    id: a.id,
    applicationId: a.applicationId,
    version: a.version,
    buildNumber: a.buildNumber,
    platform: a.platform,
    channel: a.channel,
    status: a.status,
    filename: a.filename,
    sizeBytes: a.sizeBytes,
    sha256: a.sha256 ?? undefined,
    releaseNotes: a.releaseNotes,
    uploader: a.uploader,
    uploadedAt: a.uploadedAt,
  }
}

export async function apiListArtifacts(appId: string): Promise<Artifact[]> {
  const data = await request<{ items: ApiArtifact[] }>(`/applications/${appId}/artifacts`)
  return data.items.map(mapArtifact)
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
): Promise<Artifact> {
  const form = new FormData()
  form.append('file', file)
  form.append('version', fields.version)
  if (fields.buildNumber) form.append('buildNumber', fields.buildNumber)
  if (fields.channel) form.append('channel', fields.channel)
  if (fields.platform) form.append('platform', fields.platform)
  if (fields.releaseNotes != null) form.append('releaseNotes', fields.releaseNotes)
  form.append('markLatest', fields.markLatest === false ? 'false' : 'true')

  const data = await request<{ artifact: ApiArtifact }>(
    `/applications/${appId}/artifacts`,
    { method: 'POST', rawBody: form },
  )
  return mapArtifact(data.artifact)
}

export async function apiDownloadArtifact(
  id: string,
  opts: { public?: boolean } = {},
): Promise<{ blob: Blob; filename?: string }> {
  const path = opts.public
    ? `/public/artifacts/${id}/download`
    : `/artifacts/${id}/download`
  return requestBlob(path, { public: opts.public })
}

/* ── Retention / settings ─────────────────────────────── */

export type RetentionPolicyDto = {
  maxVersions: number
  archiveDeprecatedDays: number
  storageQuotaBytes: number
  storageUsedBytes: number
  updatedAt: string
}

export async function apiGetRetention(): Promise<RetentionPolicyDto> {
  const data = await request<{ retention: RetentionPolicyDto }>('/settings/retention')
  return data.retention
}

export async function apiUpdateRetention(body: {
  maxVersions?: number
  archiveDeprecatedDays?: number
  storageQuotaBytes?: number
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

/* ── Shares (server-issued) ───────────────────────────── */

export type ShareLinkDto = {
  id: string
  token: string
  applicationId: string
  mode: 'latest' | 'artifact'
  artifactId: string | null
  createdBy: string
  createdById?: string | null
  createdAt: string
  expiresAt: string | null
  revokedAt?: string | null
  downloadCount?: number
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
    mode: 'latest' | 'artifact'
    createdBy: string
    expiresAt: string | null
    createdAt: string
  }
  application: Application
  artifact: Artifact
}

export async function apiResolveShare(token: string): Promise<PublicShareResolve> {
  return request<PublicShareResolve>(`/public/shares/${encodeURIComponent(token)}`, {
    public: true,
  })
}

export async function apiDownloadShare(
  token: string,
): Promise<{ blob: Blob; filename?: string }> {
  return requestBlob(`/public/shares/${encodeURIComponent(token)}/download`, {
    public: true,
  })
}

/* ── Public (share landing, no auth) ──────────────────── */

export async function apiPublicGetApplication(id: string): Promise<Application> {
  const data = await request<{ application: ApiApplication }>(
    `/public/applications/${id}`,
    { public: true },
  )
  return mapApp(data.application)
}

export async function apiPublicListArtifacts(appId: string): Promise<Artifact[]> {
  const data = await request<{ items: ApiArtifact[] }>(
    `/public/applications/${appId}/artifacts`,
    { public: true },
  )
  return data.items.map(mapArtifact)
}
