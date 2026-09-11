import { expect, type BrowserContext, type Download, type Page } from '@playwright/test'

import {
  englishLocaleStorageState,
  EnvironmentBlockedError,
  type CoreJourneyRuntime,
} from './runtime.js'
import type { ZipFixture } from './evidence.js'

export type PublishedArtifact = {
  id: string
  applicationId: string
  version: string
  buildNumber: string
  channel: string
  status: string
  filename: string
  sizeBytes: number
  sha256?: string
}

export type CreatedShare = {
  id: string
  token: string
}

export type UploadNavigationEvidence = {
  uploadLinkHref: string
  uploadPagePath: string
}

export type PublishedUpload = {
  artifact: PublishedArtifact
  navigation: UploadNavigationEvidence
}

function apiPath(responseUrl: string) {
  return new URL(responseUrl).pathname
}

function completionResponseFor(response: {
  url(): string
  request(): { method(): string }
}) {
  return (
    response.request().method() === 'POST' &&
    /^\/api\/uploads\/[^/]+\/complete$/.test(apiPath(response.url()))
  )
}

function downloadTicketResponseFor(
  response: { url(): string; request(): { method(): string } },
  artifactId: string,
) {
  return (
    response.request().method() === 'POST' &&
    apiPath(response.url()) === `/api/artifacts/${artifactId}/download-ticket`
  )
}

export async function useEnglishLocale(context: BrowserContext) {
  await context.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: 'artifact-center-locale', value: englishLocaleStorageState },
  )
}

/** A failed preflight is an environment block, never a passing scenario. */
export async function assertLocalReady(page: Page, runtime: CoreJourneyRuntime) {
  let response
  try {
    response = await page.request.get(`${runtime.baseUrl}/api/health/ready`)
  } catch {
    throw new EnvironmentBlockedError(
      'The configured local Artifact Center service is unreachable.',
    )
  }
  if (!response.ok()) {
    throw new EnvironmentBlockedError(
      `The configured local Artifact Center readiness check returned HTTP ${response.status()}.`,
    )
  }
  const body = (await response.json()) as { ok?: boolean }
  if (body.ok !== true) {
    throw new EnvironmentBlockedError(
      'The configured local Artifact Center readiness check did not confirm database and storage.',
    )
  }
}

export async function loginWithLocalCredentials(page: Page, runtime: CoreJourneyRuntime) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 })
  await expect(page.locator('#login-identifier')).toBeVisible()
  await page.locator('#login-identifier').fill(runtime.identifier)
  await page.locator('#login-password').fill(runtime.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/')
  await expect(
    page.getByRole('heading', { name: 'Applications', exact: true }),
  ).toBeVisible()
}

export async function readBrowserAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('artifact-center-auth')
      const parsed = raw
        ? (JSON.parse(raw) as { state?: { token?: unknown } })
        : undefined
      return typeof parsed?.state?.token === 'string' ? parsed.state.token : ''
    } catch {
      return ''
    }
  })
  if (!token) throw new Error('Browser login did not create a usable local test session.')
  return token
}

export async function findOwnedApplication(
  page: Page,
  applicationId: string,
  applicationName: string,
) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 })
  const search = page.getByRole('textbox', { name: 'Search applications', exact: true })
  await expect(search).toBeVisible()
  const preferenceSaved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      apiPath(response.url()) === '/api/workspace/preferences',
    { timeout: 15_000 },
  )
  await search.fill(applicationName)
  const preferenceResponse = await preferenceSaved
  if (!preferenceResponse.ok()) {
    throw new Error(
      `Browser search preference update returned HTTP ${preferenceResponse.status()}.`,
    )
  }
  const preferenceBody = (await preferenceResponse.json()) as {
    preferences?: { query?: string }
  }
  if (preferenceBody.preferences?.query !== applicationName) {
    throw new Error(
      'Browser search did not persist the expected owned-application query.',
    )
  }
  const result = page.getByRole('link', { name: new RegExp(applicationName) })
  await expect(result).toHaveCount(1)
  await result.click()
  await expect(page).toHaveURL((url) => url.pathname === `/applications/${applicationId}`)
  await expect(
    page.getByRole('heading', { name: applicationName, exact: true }),
  ).toBeVisible()
}

function validatePublishedArtifact(
  value: unknown,
  expected: { applicationId: string; runtime: CoreJourneyRuntime; fixture: ZipFixture },
): PublishedArtifact {
  const artifact = (value as { artifact?: PublishedArtifact } | undefined)?.artifact
  if (
    !artifact?.id ||
    artifact.applicationId !== expected.applicationId ||
    artifact.version !== expected.runtime.version ||
    artifact.buildNumber !== expected.runtime.buildNumber ||
    artifact.channel !== 'beta' ||
    artifact.status !== 'latest' ||
    artifact.sizeBytes !== expected.fixture.sizeBytes ||
    artifact.sha256 !== expected.fixture.sha256 ||
    !artifact.filename.endsWith('.zip')
  ) {
    throw new Error(
      'The published artifact did not preserve the reviewed version, beta channel, or ZIP digest.',
    )
  }
  return artifact
}

export async function uploadAndPublishThroughBrowser(
  page: Page,
  application: { id: string; name: string },
  runtime: CoreJourneyRuntime,
  fixture: ZipFixture,
  onPublished?: (artifact: PublishedArtifact) => void,
): Promise<PublishedUpload> {
  const expectedUploadHref = `/upload?app=${application.id}`
  const applicationHeader = page
    .getByRole('heading', { name: application.name, exact: true })
    .locator('xpath=ancestor::header[1]')
  const uploadLink = applicationHeader.locator(`a[href="${expectedUploadHref}"]`)
  await expect(uploadLink).toHaveCount(1)
  const uploadLinkHref = await uploadLink.getAttribute('href')
  if (uploadLinkHref !== expectedUploadHref) {
    throw new Error(
      'The owned application upload link did not retain its expected application parameter.',
    )
  }
  await uploadLink.click()
  await expect(page).toHaveURL(
    (url) => url.pathname === '/upload' && url.searchParams.get('app') === application.id,
  )
  const uploadPagePath = new URL(page.url()).pathname + new URL(page.url()).search

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(fixture.sourcePath)
  const fileStepNext = page.getByRole('button', { name: 'Next', exact: true })
  await expect(fileStepNext).toBeEnabled()
  await fileStepNext.click()
  await expect(page.locator('#artifact-version')).toBeVisible()
  await page.locator('#artifact-version').fill(runtime.version)
  await page.getByLabel(/^Build number/).fill(runtime.buildNumber)

  const channelGroup = page.getByRole('radiogroup', { name: 'Channel', exact: true })
  const beta = channelGroup.getByRole('radio', { name: 'Beta', exact: true })
  await beta.click()
  await expect(beta).toHaveAttribute('aria-checked', 'true')

  const markLatest = page.getByRole('checkbox', {
    name: 'Mark as Latest (automatic when published)',
    exact: true,
  })
  await markLatest.uncheck()
  await expect(markLatest).not.toBeChecked()
  await markLatest.check()
  await expect(markLatest).toBeChecked()

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Download filename', { exact: true })).toBeVisible()
  await expect(page.getByText('Beta', { exact: true })).toBeVisible()

  const completion = page.waitForResponse(completionResponseFor, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const response = await completion
  if (!response.ok())
    throw new Error(`Browser upload completion returned HTTP ${response.status()}.`)
  const artifact = validatePublishedArtifact(await response.json(), {
    applicationId: application.id,
    runtime,
    fixture,
  })
  onPublished?.(artifact)

  await expect(
    page.getByRole('heading', { name: 'Published', exact: true }),
  ).toBeVisible()
  const successPanel = page
    .getByRole('heading', { name: 'Published', exact: true })
    .locator('xpath=..')
  await successPanel.getByRole('link', { name: 'View Application', exact: true }).click()
  await expect(page).toHaveURL(
    (url) => url.pathname === `/applications/${application.id}`,
  )
  await expect(
    page.getByRole('heading', { name: application.name, exact: true }),
  ).toBeVisible()
  return { artifact, navigation: { uploadLinkHref, uploadPagePath } }
}

export async function confirmPublishedVersion(
  page: Page,
  runtime: CoreJourneyRuntime,
  artifact: PublishedArtifact,
) {
  await page.getByRole('tab', { name: /^Artifacts/ }).click()
  const row = page.getByRole('row').filter({ hasText: `v${runtime.version}` })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Beta')
  await expect(row).toContainText('Latest')
  await expect(
    row.getByRole('button', { name: `Download ${artifact.filename}`, exact: true }),
  ).toBeVisible()
}

async function confirmBetaDownload(
  page: Page,
  action: () => Promise<void>,
): Promise<Download> {
  await action()
  const confirmation = page.getByRole('alertdialog')
  await expect(confirmation).toBeVisible()
  const download = page.waitForEvent('download', { timeout: 15_000 })
  await confirmation
    .getByRole('button', { name: 'Download test version', exact: true })
    .click()
  return download
}

export async function downloadAuthenticatedArtifact(
  page: Page,
  artifact: PublishedArtifact,
): Promise<Download> {
  const ticket = page.waitForResponse(
    (response) => downloadTicketResponseFor(response, artifact.id),
    { timeout: 15_000 },
  )
  const download = await confirmBetaDownload(page, async () => {
    await page
      .getByRole('button', { name: `Download ${artifact.filename}`, exact: true })
      .click()
  })
  const ticketResponse = await ticket
  if (!ticketResponse.ok()) {
    throw new Error(
      `Authenticated download ticket returned HTTP ${ticketResponse.status()}.`,
    )
  }
  return download
}

export async function createPinnedShareThroughBrowser(
  page: Page,
  runtime: CoreJourneyRuntime,
  artifact: PublishedArtifact,
): Promise<CreatedShare> {
  await page
    .getByRole('button', { name: `Share v${runtime.version}`, exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Share download link', exact: true })
  await expect(dialog).toBeVisible()
  const pinned = dialog.getByRole('radio', {
    name: new RegExp(`^Pin v${runtime.version}`),
  })
  await pinned.click()
  await expect(pinned).toHaveAttribute('aria-checked', 'true')
  await dialog.getByRole('button', { name: '1 day', exact: true }).click()

  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      apiPath(response.url()) === `/api/applications/${artifact.applicationId}/shares`,
    { timeout: 15_000 },
  )
  await dialog.getByRole('button', { name: 'Create & copy link', exact: true }).click()
  const response = await responsePromise
  if (!response.ok())
    throw new Error(`Browser share creation returned HTTP ${response.status()}.`)
  const payload = (await response.json()) as { share?: CreatedShare }
  const share = payload.share
  if (!share?.id || !share.token) {
    throw new Error('Browser share creation did not return a capability credential.')
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  return share
}

export async function openPublicShare(
  page: Page,
  runtime: CoreJourneyRuntime,
  token: string,
  applicationName: string,
) {
  try {
    const response = await page.goto(
      `${runtime.baseUrl}/d/${encodeURIComponent(token)}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      },
    )
    if (!response?.ok()) throw new Error('unexpected status')
  } catch {
    throw new Error('The public share page did not load from the local application.')
  }
  const sharedItem = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: applicationName, exact: true }) })
  await expect(sharedItem).toHaveCount(1)
  await expect(sharedItem).toContainText('Beta')
}

export async function downloadFromPublicShare(page: Page): Promise<Download> {
  return confirmBetaDownload(page, async () => {
    await page.getByRole('button', { name: 'Download', exact: true }).click()
  })
}

/** Verify that deleting the owned application also made its one-time share unusable. */
export async function verifyPublicShareCleanup(page: Page) {
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 })
  } catch {
    throw new Error('The public share cleanup check could not reload the local page.')
  }
  await expect(
    page.getByRole('heading', { name: 'Invalid link', exact: true }),
  ).toBeVisible()
}
