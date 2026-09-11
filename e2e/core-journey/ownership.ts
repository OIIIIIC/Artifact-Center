import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { APIRequestContext } from '@playwright/test'

import {
  EnvironmentBlockedError,
  TEST_FAMILY_PREFIX,
  type CoreJourneyRuntime,
} from './runtime.js'

type ApiErrorBody = { error?: { code?: string; message?: string } }

type ApplicationRecord = {
  id: string
  name: string
  applicationCode: string
  packageName: string
  artifactCount: number
  status: string
}

export type OwnedApplication = ApplicationRecord & {
  regionId: string
  projectId: string
}

type Product = { id: string; enabled: boolean }
type Project = { id: string; productId: string; enabled: boolean; isDefault: boolean }

export type InventorySnapshot = {
  applicationIds: string[]
  artifactCountsByApplication: Record<string, number>
  totalArtifacts: number
}

export type WorkspacePreferences = {
  platform: 'all' | 'android' | 'windows' | 'zip'
  sort: 'updated' | 'name' | 'created'
  regionId: string | null
  projectId?: string | null
  query: string
  favoriteOnly: boolean
  responsibleOnly: boolean
  collapsed: boolean
}

export type WorkspaceSnapshot = {
  favoriteApplicationIds: string[]
  recentApplications: Array<{ applicationId: string; viewedAt: string }>
  preferences: WorkspacePreferences
}

function workspaceRecoveryPath(runId: string) {
  return path.resolve(
    process.cwd(),
    '.diagnostics',
    `terra-core-e2e-workspace-${runId}.json`,
  )
}

/**
 * Keep an ignored, local-only recovery record until teardown proves that the
 * original workspace state is back. It intentionally contains no credentials.
 */
export async function persistWorkspaceRecovery(
  runId: string,
  workspace: WorkspaceSnapshot,
) {
  const destination = workspaceRecoveryPath(runId)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8')
  return destination
}

export async function removeWorkspaceRecovery(runId: string) {
  await rm(workspaceRecoveryPath(runId), { force: true })
}

export type OwnedDataEntry = {
  kind: 'application' | 'artifact' | 'share'
  id: string
  name?: string
  state: 'registered' | 'deleted'
}

/** The registry is intentionally small, serializable, and free of credentials/tokens. */
export class OwnedDataRegistry {
  private readonly entries: OwnedDataEntry[] = []

  register(entry: Omit<OwnedDataEntry, 'state'>) {
    if (
      this.entries.some(
        (current) => current.kind === entry.kind && current.id === entry.id,
      )
    ) {
      return
    }
    this.entries.push({ ...entry, state: 'registered' })
  }

  markDeleted(kind: OwnedDataEntry['kind'], id: string) {
    const entry = this.entries.find(
      (current) => current.kind === kind && current.id === id,
    )
    if (entry) entry.state = 'deleted'
  }

  snapshot(): OwnedDataEntry[] {
    return this.entries.map((entry) => ({ ...entry }))
  }
}

export class LocalApi {
  private readonly request: APIRequestContext
  private readonly apiUrl: string
  private readonly token: string

  constructor(request: APIRequestContext, apiUrl: string, token: string) {
    this.request = request
    this.apiUrl = apiUrl
    this.token = token
  }

  async get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path)
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    return this.send<T>('POST', path, data)
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    return this.send<T>('PUT', path, data)
  }

  async delete(path: string): Promise<void> {
    await this.send<unknown>('DELETE', path)
  }

  async getOrUndefined<T>(path: string): Promise<T | undefined> {
    const response = await this.request.fetch(`${this.apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      timeout: 15_000,
    })
    if (response.status() === 404) return undefined
    if (!response.ok()) throw await this.failure(response.status(), path, response)
    return (await response.json()) as T
  }

  private async send<T>(method: string, path: string, data?: unknown): Promise<T> {
    const response = await this.request.fetch(`${this.apiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}` },
      timeout: 15_000,
      ...(data === undefined ? {} : { data }),
    })
    if (!response.ok()) throw await this.failure(response.status(), path, response)
    return (await response.json()) as T
  }

  private async failure(
    status: number,
    path: string,
    response: Awaited<ReturnType<APIRequestContext['fetch']>>,
  ): Promise<Error> {
    let code = 'unknown'
    try {
      code = ((await response.json()) as ApiErrorBody).error?.code ?? code
    } catch {
      // The status and endpoint are enough for a safe diagnostic.
    }
    return new Error(`Fixture API ${path} failed (${status}, ${code}).`)
  }
}

async function allApplications(api: LocalApi): Promise<ApplicationRecord[]> {
  const data = await api.get<{ items: ApplicationRecord[] }>('/applications')
  return data.items
}

/** Snapshot every pre-existing visible application before setup and after teardown. */
export async function snapshotPreexistingInventory(
  api: LocalApi,
): Promise<InventorySnapshot> {
  const applications = (await allApplications(api)).sort((left, right) =>
    left.id.localeCompare(right.id),
  )

  return {
    applicationIds: applications.map((application) => application.id),
    artifactCountsByApplication: Object.fromEntries(
      applications.map((application) => [application.id, application.artifactCount]),
    ),
    totalArtifacts: applications.reduce(
      (total, application) => total + application.artifactCount,
      0,
    ),
  }
}

export function inventoryDifferences(
  before: InventorySnapshot,
  after: InventorySnapshot,
): string[] {
  const differences: string[] = []
  if (before.applicationIds.join(',') !== after.applicationIds.join(',')) {
    differences.push('pre-existing application IDs changed')
  }
  if (before.totalArtifacts !== after.totalArtifacts) {
    differences.push('pre-existing artifact total changed')
  }
  const allIds = new Set([
    ...Object.keys(before.artifactCountsByApplication),
    ...Object.keys(after.artifactCountsByApplication),
  ])
  for (const id of allIds) {
    if (
      before.artifactCountsByApplication[id] !== after.artifactCountsByApplication[id]
    ) {
      differences.push(`pre-existing artifact count changed for ${id}`)
    }
  }
  return differences
}

export function normalizeWorkspaceSnapshot(
  workspace: WorkspaceSnapshot,
): WorkspaceSnapshot {
  return {
    favoriteApplicationIds: [...workspace.favoriteApplicationIds].sort(),
    recentApplications: [...workspace.recentApplications].sort((left, right) =>
      left.applicationId.localeCompare(right.applicationId),
    ),
    preferences: {
      ...workspace.preferences,
      projectId: workspace.preferences.projectId ?? null,
    },
  }
}

export async function snapshotWorkspace(api: LocalApi): Promise<WorkspaceSnapshot> {
  return normalizeWorkspaceSnapshot(await api.get<WorkspaceSnapshot>('/workspace'))
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Restore the user-visible list filters and verify the persisted result. */
export async function restoreWorkspacePreferences(
  api: LocalApi,
  original: WorkspaceSnapshot,
) {
  const restored = await api.put<{ preferences: WorkspacePreferences }>(
    '/workspace/preferences',
    original.preferences,
  )
  const expectedPreferences = {
    ...original.preferences,
    projectId: original.preferences.projectId ?? null,
  }
  const actualPreferences = {
    ...restored.preferences,
    projectId: restored.preferences.projectId ?? null,
  }
  if (!sameJson(actualPreferences, expectedPreferences)) {
    throw new Error(
      'Workspace filter restoration response did not match its original state.',
    )
  }

  const verified = await snapshotWorkspace(api)
  if (!sameJson(verified.preferences, expectedPreferences)) {
    throw new Error('Workspace filter restoration did not persist.')
  }
  return verified
}

export function workspaceDifferences(
  before: WorkspaceSnapshot,
  after: WorkspaceSnapshot,
): string[] {
  const differences: string[] = []
  if (!sameJson(before.preferences, after.preferences)) {
    differences.push('workspace preferences changed')
  }
  if (!sameJson(before.favoriteApplicationIds, after.favoriteApplicationIds)) {
    differences.push('workspace favorites changed')
  }
  if (!sameJson(before.recentApplications, after.recentApplications)) {
    differences.push('workspace recent applications changed')
  }
  return differences
}

export async function requireCleanupAuthority(api: LocalApi) {
  const me = await api.get<{ user: { role: string } }>('/auth/me')
  if (me.user.role !== 'admin') {
    throw new EnvironmentBlockedError(
      'The local E2E account must be an admin so its owned application can be safely removed.',
    )
  }
}

/**
 * Setup chooses an existing enabled Product/default Project but never mutates either.
 * Application creation is registered immediately after response ownership validation.
 */
export async function createOwnedApplication(
  api: LocalApi,
  runtime: CoreJourneyRuntime,
  registry: OwnedDataRegistry,
): Promise<OwnedApplication> {
  const productResult = await api.get<{ items: Product[] }>('/settings/regions')
  const product = productResult.items.find((item) => item.enabled)
  if (!product) {
    throw new EnvironmentBlockedError(
      'No enabled local Product is available for the isolated E2E app.',
    )
  }

  const projectResult = await api.get<{ items: Project[] }>(
    `/settings/projects?productId=${encodeURIComponent(product.id)}`,
  )
  const project =
    projectResult.items.find(
      (item) => item.productId === product.id && item.enabled && item.isDefault,
    ) ?? projectResult.items.find((item) => item.productId === product.id && item.enabled)
  if (!project) {
    throw new EnvironmentBlockedError(
      'The selected local Product has no enabled Project for the isolated E2E app.',
    )
  }

  const created = await api.post<{ application: ApplicationRecord }>('/applications', {
    name: runtime.applicationName,
    applicationCode: runtime.applicationCode,
    description: 'Owned by the local core-journey E2E suite and removed during teardown.',
    packageName: runtime.packageName,
    platform: 'zip',
    regionId: product.id,
    projectId: project.id,
  })
  const application = created.application
  if (
    !application?.id ||
    application.name !== runtime.applicationName ||
    !application.name.startsWith(`${TEST_FAMILY_PREFIX}${runtime.runId}`) ||
    application.applicationCode !== runtime.applicationCode ||
    application.packageName !== runtime.packageName
  ) {
    throw new Error('Created application failed the E2E ownership identity check.')
  }

  registry.register({ kind: 'application', id: application.id, name: application.name })
  return { ...application, regionId: product.id, projectId: project.id }
}

/** Delete only the exact ID whose current server-side name still carries this run's prefix. */
export async function deleteOwnedApplication(
  api: LocalApi,
  application: OwnedApplication,
  runtime: CoreJourneyRuntime,
  registry: OwnedDataRegistry,
  artifactIds: string[],
) {
  const current = await api.getOrUndefined<{ application: ApplicationRecord }>(
    `/applications/${encodeURIComponent(application.id)}`,
  )
  if (!current) {
    await verifyArtifactsDeleted(api, artifactIds, registry)
    registry.markDeleted('application', application.id)
    return
  }
  const expectedPrefix = `${TEST_FAMILY_PREFIX}${runtime.runId}`
  if (
    current.application.id !== application.id ||
    current.application.name !== application.name ||
    !current.application.name.startsWith(expectedPrefix)
  ) {
    throw new Error(
      'Refusing cleanup: application ID and E2E name prefix no longer match.',
    )
  }

  await api.delete(`/applications/${encodeURIComponent(application.id)}`)
  const gone = await api.getOrUndefined<{ application: ApplicationRecord }>(
    `/applications/${encodeURIComponent(application.id)}`,
  )
  if (gone) throw new Error('Owned application still exists after cleanup.')
  await verifyArtifactsDeleted(api, artifactIds, registry)
  registry.markDeleted('application', application.id)
}

async function verifyArtifactsDeleted(
  api: LocalApi,
  artifactIds: string[],
  registry: OwnedDataRegistry,
) {
  for (const artifactId of artifactIds) {
    const artifact = await api.getOrUndefined<{ artifact: { id: string } }>(
      `/artifacts/${encodeURIComponent(artifactId)}`,
    )
    if (artifact)
      throw new Error('Owned artifact still exists after application cleanup.')
    registry.markDeleted('artifact', artifactId)
  }
}
