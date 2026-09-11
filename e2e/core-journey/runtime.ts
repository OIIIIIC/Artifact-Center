import { randomUUID } from 'node:crypto'

export const TEST_FAMILY_PREFIX = 'E2E-TERRA-CORE-'

export type CoreJourneyRuntime = {
  baseUrl: string
  apiUrl: string
  identifier: string
  password: string
  runId: string
  applicationName: string
  applicationCode: string
  packageName: string
  version: string
  buildNumber: string
  releaseNotes: string
}

export class EnvironmentBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvironmentBlockedError'
  }
}

function requiredEnvironment(name: string, trim = true): string {
  const raw = process.env[name]
  const value = trim ? raw?.trim() : raw
  if (!value) {
    throw new EnvironmentBlockedError(
      `Missing local E2E prerequisite: set ${name} outside the repository.`,
    )
  }
  return value
}

function localOrigin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new EnvironmentBlockedError('E2E_BASE_URL must be a valid localhost URL.')
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
  if (
    !localHosts.has(url.hostname) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new EnvironmentBlockedError(
      'This suite only permits an explicitly local HTTP(S) Artifact Center target.',
    )
  }
  return url.origin
}

function newRunId(): string {
  const requested = process.env.E2E_RUN_ID?.trim().toLowerCase()
  if (requested) {
    if (!/^[a-z0-9-]{6,48}$/.test(requested)) {
      throw new EnvironmentBlockedError(
        'E2E_RUN_ID may contain only lowercase letters, digits, and hyphens.',
      )
    }
    return requested
  }
  return `${Date.now().toString(36)}-${randomUUID().replaceAll('-', '').slice(0, 10)}`
}

/** Load secrets only from process environment; never write them to test artifacts. */
export function loadCoreJourneyRuntime(): CoreJourneyRuntime {
  const baseUrl = localOrigin(process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5178')
  const runId = newRunId()
  const compactRunId = runId.replaceAll('-', '')

  return {
    baseUrl,
    apiUrl: `${baseUrl}/api`,
    identifier: requiredEnvironment('E2E_AUTH_IDENTIFIER'),
    password: requiredEnvironment('E2E_AUTH_PASSWORD', false),
    runId,
    applicationName: `${TEST_FAMILY_PREFIX}${runId}`,
    applicationCode: `terra-core-${runId}`,
    packageName: `com.artifactcenter.e2e.${compactRunId}`,
    version: '1.0.0',
    buildNumber: '9001',
    releaseNotes: 'Automated local browser verification package.',
  }
}

/** Persisted before the application scripts initialize so role names stay stable. */
export const englishLocaleStorageState = JSON.stringify({
  state: { locale: 'en-US' },
  version: 0,
})
