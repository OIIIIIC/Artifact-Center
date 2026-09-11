import { test, type BrowserContext, type Page, type TestInfo } from '@playwright/test'

import {
  assertLocalReady,
  confirmPublishedVersion,
  createPinnedShareThroughBrowser,
  downloadAuthenticatedArtifact,
  downloadFromPublicShare,
  findOwnedApplication,
  loginWithLocalCredentials,
  openPublicShare,
  readBrowserAccessToken,
  uploadAndPublishThroughBrowser,
  useEnglishLocale,
  verifyPublicShareCleanup,
  type CreatedShare,
  type PublishedArtifact,
} from './browser-flow.js'
import {
  captureSafeScreenshot,
  createZipFixture,
  inventoryEvidence,
  ownershipEvidence,
  verifyDownloadedZip,
  workspaceEvidence,
  writeSafeEvidence,
  type DownloadEvidence,
} from './evidence.js'
import {
  createOwnedApplication,
  deleteOwnedApplication,
  inventoryDifferences,
  LocalApi,
  normalizeWorkspaceSnapshot,
  OwnedDataRegistry,
  persistWorkspaceRecovery,
  requireCleanupAuthority,
  removeWorkspaceRecovery,
  restoreWorkspacePreferences,
  snapshotPreexistingInventory,
  workspaceDifferences,
  type InventorySnapshot,
  type OwnedApplication,
  type WorkspaceSnapshot,
} from './ownership.js'
import { SensitiveValueRedactor, safeErrorMessage } from './redaction.js'
import {
  EnvironmentBlockedError,
  loadCoreJourneyRuntime,
  type CoreJourneyRuntime,
} from './runtime.js'

function addFailure(target: unknown[], action: () => Promise<void>) {
  return action().catch((error: unknown) => target.push(error))
}

function markBlocked(
  testInfo: TestInfo,
  error: unknown,
  redactor: SensitiveValueRedactor,
) {
  const message = safeErrorMessage(error, redactor)
  testInfo.annotations.push({ type: 'blocked', description: message })
  test.skip(true, `BLOCKED: ${message}`)
}

test.describe('Artifact Center core browser journey', () => {
  test('logs in, publishes a beta ZIP, validates authenticated and shared downloads, then cleans up', async ({
    browser,
    page,
  }, testInfo) => {
    testInfo.setTimeout(180_000)
    const redactor = new SensitiveValueRedactor()
    let runtime: CoreJourneyRuntime | undefined
    try {
      runtime = loadCoreJourneyRuntime()
      redactor.add(runtime.identifier)
      redactor.add(runtime.password)
    } catch (error) {
      markBlocked(testInfo, error, redactor)
      return
    }
    if (!runtime) return

    try {
      await useEnglishLocale(page.context())
      await assertLocalReady(page, runtime)
    } catch (error) {
      if (error instanceof EnvironmentBlockedError) {
        markBlocked(testInfo, error, redactor)
        return
      }
      throw new Error(safeErrorMessage(error, redactor), { cause: error })
    }

    const initialWorkspaceSnapshot = page
      .waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/workspace',
        { timeout: 15_000 },
      )
      .then(async (response) => {
        if (!response.ok()) {
          throw new EnvironmentBlockedError(
            `The logged-in workspace read returned HTTP ${response.status()}.`,
          )
        }
        return normalizeWorkspaceSnapshot((await response.json()) as WorkspaceSnapshot)
      })

    let token: string | undefined
    try {
      await loginWithLocalCredentials(page, runtime)
      token = await readBrowserAccessToken(page)
      redactor.add(token)
    } catch (error) {
      throw new Error(safeErrorMessage(error, redactor), { cause: error })
    }
    if (!token) return

    const api = new LocalApi(page.request, runtime.apiUrl, token)
    let workspaceBefore: WorkspaceSnapshot | undefined
    let inventoryBefore: InventorySnapshot | undefined
    try {
      workspaceBefore = await initialWorkspaceSnapshot
      await requireCleanupAuthority(api)
      inventoryBefore = await snapshotPreexistingInventory(api)
    } catch (error) {
      if (error instanceof EnvironmentBlockedError) {
        markBlocked(testInfo, error, redactor)
        return
      }
      throw new Error(safeErrorMessage(error, redactor), { cause: error })
    }
    const originalWorkspace = workspaceBefore
    const originalInventory = inventoryBefore
    if (!originalWorkspace || !originalInventory) return
    await persistWorkspaceRecovery(runtime.runId, originalWorkspace)

    const registry = new OwnedDataRegistry()
    let application: OwnedApplication | undefined
    let artifact: PublishedArtifact | undefined
    let share: CreatedShare | undefined
    let publicPage: Page | undefined
    let publicContext: BrowserContext | undefined
    let authenticatedDownload: DownloadEvidence | undefined
    let sharedDownload: DownloadEvidence | undefined
    let inventoryAfter: InventorySnapshot | undefined
    let workspaceAfter: WorkspaceSnapshot | undefined
    let workspaceRecoveryCleared = false
    const cleanupFailures: unknown[] = []
    let workflowFailure: unknown

    try {
      application = await createOwnedApplication(api, runtime, registry)
      await writeSafeEvidence(testInfo, 'owned-data-setup.json', {
        runId: runtime.runId,
        targetOrigin: runtime.baseUrl,
        entries: ownershipEvidence(registry.snapshot()),
      })

      await findOwnedApplication(page, application.id, application.name)
      const fixture = await createZipFixture(testInfo, runtime)
      const publishedUpload = await uploadAndPublishThroughBrowser(
        page,
        application,
        runtime,
        fixture,
        (publishedArtifact) => {
          artifact = publishedArtifact
          registry.register({
            kind: 'artifact',
            id: publishedArtifact.id,
            name: publishedArtifact.filename,
          })
        },
      )
      artifact = publishedUpload.artifact
      await writeSafeEvidence(testInfo, 'owned-data-published.json', {
        runId: runtime.runId,
        entries: ownershipEvidence(registry.snapshot()),
        published: {
          version: artifact.version,
          channel: artifact.channel,
          status: artifact.status,
          filename: artifact.filename,
          sizeBytes: artifact.sizeBytes,
          sha256: artifact.sha256,
        },
        uploadNavigation: publishedUpload.navigation,
      })

      await confirmPublishedVersion(page, runtime, artifact)
      await captureSafeScreenshot(page, testInfo, 'published-beta-artifact')
      authenticatedDownload = await verifyDownloadedZip(
        testInfo,
        await downloadAuthenticatedArtifact(page, artifact),
        { ...fixture, filename: artifact.filename },
        'authenticated',
      )

      const createdShare = await createPinnedShareThroughBrowser(page, runtime, artifact)
      share = createdShare
      redactor.add(createdShare.token)
      registry.register({ kind: 'share', id: createdShare.id })
      await writeSafeEvidence(testInfo, 'owned-data-shared.json', {
        runId: runtime.runId,
        entries: ownershipEvidence(registry.snapshot()),
        share: { id: createdShare.id, mode: 'artifact', expiresInDays: 1 },
      })

      const createdPublicContext = await browser.newContext({ acceptDownloads: true })
      publicContext = createdPublicContext
      await useEnglishLocale(createdPublicContext)
      const createdPublicPage = await createdPublicContext.newPage()
      publicPage = createdPublicPage
      await openPublicShare(
        createdPublicPage,
        runtime,
        createdShare.token,
        application.name,
      )
      await captureSafeScreenshot(
        createdPublicPage,
        testInfo,
        'public-share-before-download',
      )
      sharedDownload = await verifyDownloadedZip(
        testInfo,
        await downloadFromPublicShare(createdPublicPage),
        { ...fixture, filename: artifact.filename },
        'shared',
      )
    } catch (error) {
      workflowFailure = error
    } finally {
      if (application) {
        const ownedApplication = application
        await addFailure(cleanupFailures, async () => {
          await deleteOwnedApplication(
            api,
            ownedApplication,
            runtime,
            registry,
            artifact ? [artifact.id] : [],
          )
        })
      }

      if (share) {
        const createdShare = share
        const sharePage = publicPage
        if (!sharePage) {
          cleanupFailures.push(
            new Error(
              'A created share link could not be checked for cleanup because no public browser page exists.',
            ),
          )
        } else {
          await addFailure(cleanupFailures, async () => {
            await verifyPublicShareCleanup(sharePage)
            registry.markDeleted('share', createdShare.id)
          })
        }
      }

      if (publicContext) {
        const createdPublicContext = publicContext
        await addFailure(cleanupFailures, async () => {
          await createdPublicContext.close()
        })
      }

      await addFailure(cleanupFailures, async () => {
        const restoredWorkspace = await restoreWorkspacePreferences(
          api,
          originalWorkspace,
        )
        workspaceAfter = restoredWorkspace
        const differences = workspaceDifferences(originalWorkspace, restoredWorkspace)
        if (differences.length) {
          throw new Error(`Workspace restoration mismatch: ${differences.join('; ')}.`)
        }
      })

      if (
        workspaceAfter &&
        !workspaceDifferences(originalWorkspace, workspaceAfter).length
      ) {
        await addFailure(cleanupFailures, async () => {
          await removeWorkspaceRecovery(runtime.runId)
          workspaceRecoveryCleared = true
        })
      }

      await addFailure(cleanupFailures, async () => {
        const finalInventory = await snapshotPreexistingInventory(api)
        inventoryAfter = finalInventory
        const differences = inventoryDifferences(originalInventory, finalInventory)
        if (differences.length) {
          throw new Error(`Pre-existing inventory changed: ${differences.join('; ')}.`)
        }
      })

      await addFailure(cleanupFailures, async () => {
        const finalInventory = inventoryAfter
        const finalWorkspace = workspaceAfter
        await writeSafeEvidence(testInfo, 'core-journey-evidence.json', {
          runner: testInfo.project.name,
          targetOrigin: runtime.baseUrl,
          runId: runtime.runId,
          status: workflowFailure || cleanupFailures.length ? 'failed' : 'passed',
          downloads: [authenticatedDownload, sharedDownload].filter(Boolean),
          inventory: {
            before: inventoryEvidence(originalInventory),
            after: inventoryEvidence(finalInventory),
            unchanged: finalInventory
              ? !inventoryDifferences(originalInventory, finalInventory).length
              : false,
          },
          workspace: {
            before: workspaceEvidence(originalWorkspace),
            after: workspaceEvidence(finalWorkspace),
            restored: finalWorkspace
              ? !workspaceDifferences(originalWorkspace, finalWorkspace).length
              : false,
          },
          cleanup: {
            ownedData: ownershipEvidence(registry.snapshot()),
            workspaceRecoveryCleared,
            publicShareInvalidated: share
              ? registry
                  .snapshot()
                  .some((entry) => entry.kind === 'share' && entry.state === 'deleted')
              : true,
          },
          failures: [workflowFailure, ...cleanupFailures]
            .filter(Boolean)
            .map((error) => safeErrorMessage(error, redactor)),
        })
      })
    }

    const failures = [workflowFailure, ...cleanupFailures].filter(Boolean)
    if (failures.length === 1) throw new Error(safeErrorMessage(failures[0], redactor))
    if (failures.length > 1) {
      throw new AggregateError(
        failures.map((error) => new Error(safeErrorMessage(error, redactor))),
        'Core journey or cleanup failed.',
      )
    }
  })
})
