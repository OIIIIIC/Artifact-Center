import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Download, Page, TestInfo } from '@playwright/test'

import type { InventorySnapshot, OwnedDataEntry, WorkspaceSnapshot } from './ownership.js'
import type { CoreJourneyRuntime } from './runtime.js'
import { redactText } from './redaction.js'

export type ZipFixture = {
  sourcePath: string
  originalFilename: string
  sizeBytes: number
  sha256: string
}

export type DownloadEvidence = {
  label: string
  filename: string
  sizeBytes: number
  sha256: string
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < table.length; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(data: Buffer) {
  let value = 0xffffffff
  for (const byte of data) value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

/** Generate a standards-compliant stored ZIP without adding a production dependency. */
function createStoredZip(filename: string, contents: Buffer): Buffer {
  const filenameBytes = Buffer.from(filename, 'utf8')
  const checksum = crc32(contents)

  const localHeader = Buffer.alloc(30)
  localHeader.writeUInt32LE(0x04034b50, 0)
  localHeader.writeUInt16LE(20, 4)
  localHeader.writeUInt32LE(checksum, 14)
  localHeader.writeUInt32LE(contents.length, 18)
  localHeader.writeUInt32LE(contents.length, 22)
  localHeader.writeUInt16LE(filenameBytes.length, 26)

  const centralHeader = Buffer.alloc(46)
  centralHeader.writeUInt32LE(0x02014b50, 0)
  centralHeader.writeUInt16LE(20, 4)
  centralHeader.writeUInt16LE(20, 6)
  centralHeader.writeUInt32LE(checksum, 16)
  centralHeader.writeUInt32LE(contents.length, 20)
  centralHeader.writeUInt32LE(contents.length, 24)
  centralHeader.writeUInt16LE(filenameBytes.length, 28)

  const localFile = Buffer.concat([localHeader, filenameBytes, contents])
  const centralDirectory = Buffer.concat([centralHeader, filenameBytes])
  const endOfDirectory = Buffer.alloc(22)
  endOfDirectory.writeUInt32LE(0x06054b50, 0)
  endOfDirectory.writeUInt16LE(1, 8)
  endOfDirectory.writeUInt16LE(1, 10)
  endOfDirectory.writeUInt32LE(centralDirectory.length, 12)
  endOfDirectory.writeUInt32LE(localFile.length, 16)

  return Buffer.concat([localFile, centralDirectory, endOfDirectory])
}

function sha256(contents: Buffer) {
  return createHash('sha256').update(contents).digest('hex')
}

async function ensureParentDirectory(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true })
}

export async function createZipFixture(
  testInfo: TestInfo,
  runtime: CoreJourneyRuntime,
): Promise<ZipFixture> {
  const originalFilename = `terra-core-e2e-1.0.0-${runtime.runId}.zip`
  const content = Buffer.from(
    `Artifact Center local E2E fixture\nrun=${runtime.runId}\nversion=${runtime.version}\n`,
    'utf8',
  )
  const zip = createStoredZip('manifest.txt', content)
  const sourcePath = testInfo.outputPath('fixtures', originalFilename)
  await ensureParentDirectory(sourcePath)
  await writeFile(sourcePath, zip)
  return {
    sourcePath,
    originalFilename,
    sizeBytes: zip.length,
    sha256: sha256(zip),
  }
}

export async function verifyDownloadedZip(
  testInfo: TestInfo,
  download: Download,
  expected: Pick<ZipFixture, 'sizeBytes' | 'sha256'> & { filename: string },
  label: string,
): Promise<DownloadEvidence> {
  const filename = download.suggestedFilename()
  if (filename !== expected.filename) {
    throw new Error(`${label} download filename did not match the published artifact.`)
  }
  const destination = testInfo.outputPath('downloads', `${label}-${filename}`)
  await ensureParentDirectory(destination)
  await download.saveAs(destination)
  const contents = await readFile(destination)
  const actualHash = sha256(contents)
  if (contents.length !== expected.sizeBytes) {
    throw new Error(`${label} download byte length did not match the uploaded ZIP.`)
  }
  if (actualHash !== expected.sha256) {
    throw new Error(`${label} download SHA-256 did not match the uploaded ZIP.`)
  }
  return { label, filename, sizeBytes: contents.length, sha256: actualHash }
}

/** Screenshots are intentionally captured only after login and after share-token UI is closed. */
export async function captureSafeScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const destination = testInfo.outputPath('screenshots', `${name}.png`)
  await ensureParentDirectory(destination)
  await page.screenshot({ path: destination, fullPage: true })
  await testInfo.attach(name, { path: destination, contentType: 'image/png' })
}

function redactForReport(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value)
  if (Array.isArray(value)) return value.map(redactForReport)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, redactForReport(nested)]),
    )
  }
  return value
}

export async function writeSafeEvidence(
  testInfo: TestInfo,
  filename: string,
  evidence: Record<string, unknown>,
) {
  const destination = testInfo.outputPath(filename)
  await ensureParentDirectory(destination)
  await writeFile(
    destination,
    `${JSON.stringify(redactForReport(evidence), null, 2)}\n`,
    'utf8',
  )
  await testInfo.attach(filename, { path: destination, contentType: 'application/json' })
}

export function ownershipEvidence(entries: OwnedDataEntry[]) {
  return entries.map(({ kind, id, name, state }) => ({ kind, id, name, state }))
}

function fingerprint(value: unknown) {
  return sha256(Buffer.from(JSON.stringify(value), 'utf8'))
}

/**
 * Compare unrelated data without exposing existing application IDs in a
 * review artifact. The hash includes each ID/count pair.
 */
export function inventoryEvidence(snapshot: InventorySnapshot | undefined) {
  if (!snapshot) return undefined
  return {
    applicationCount: snapshot.applicationIds.length,
    totalArtifacts: snapshot.totalArtifacts,
    applicationIdsSha256: fingerprint(snapshot.applicationIds),
    artifactCountsByApplicationSha256: fingerprint(snapshot.artifactCountsByApplication),
  }
}

/** Do not record a user's query text or existing application IDs. */
export function workspaceEvidence(snapshot: WorkspaceSnapshot | undefined) {
  if (!snapshot) return undefined
  return {
    favoriteCount: snapshot.favoriteApplicationIds.length,
    recentCount: snapshot.recentApplications.length,
    stateSha256: fingerprint(snapshot),
  }
}
