import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { mkdir, readdir, rm, statfs, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import { finished, pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'

import { env } from '../env.js'
import { deleteObject, openObjectDownloadStream } from './object-storage.js'

export function ensureStorageRoot() {
  if (!existsSync(env.storagePath)) {
    mkdirSync(env.storagePath, { recursive: true })
  }
}

export type StorageDiskSpace = {
  totalBytes: number
  usedBytes: number
  freeBytes: number
}

/** 获取制品目录所在文件系统的实时容量；Windows 与 Linux 均支持。 */
export async function getStorageDiskSpace(): Promise<StorageDiskSpace | null> {
  try {
    ensureStorageRoot()
    const stats = await statfs(env.storagePath, { bigint: true })
    const totalBytes = Number(stats.blocks * stats.bsize)
    const freeBytes = Number(stats.bavail * stats.bsize)
    return {
      totalBytes,
      freeBytes,
      usedBytes: Math.max(0, totalBytes - freeBytes),
    }
  } catch (error) {
    console.error('[storage] statfs failed', env.storagePath, error)
    return null
  }
}

export function storageKeyFor(applicationId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_')
  const stamp = Date.now().toString(36)
  return path.posix.join(applicationId, `${stamp}-${safe}`)
}

export function absolutePathFor(storageKey: string): string {
  const root = path.resolve(env.storagePath)
  const absolute = path.resolve(root, storageKey)
  const relative = path.relative(root, absolute)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('path_traversal')
  }
  return absolute
}

export async function saveUploadStream(
  storageKey: string,
  stream: Readable,
): Promise<{ sizeBytes: number; sha256: string }> {
  const abs = absolutePathFor(storageKey)
  await mkdir(path.dirname(abs), { recursive: true })

  const hash = createHash('sha256')
  let sizeBytes = 0
  const out = createWriteStream(abs)

  stream.on('data', (chunk: Buffer) => {
    sizeBytes += chunk.length
    hash.update(chunk)
  })

  try {
    await pipeline(stream, out)
  } catch (error) {
    await unlink(abs).catch(() => undefined)
    throw error
  }
  return { sizeBytes, sha256: hash.digest('hex') }
}

function uploadPartStorageKey(sessionId: string, partNumber: number): string {
  return path.posix.join('_uploads', sessionId, 'parts', `${partNumber}.part`)
}

export async function saveUploadPart(
  sessionId: string,
  partNumber: number,
  stream: Readable,
) {
  return saveUploadStream(uploadPartStorageKey(sessionId, partNumber), stream)
}

/** Concatenate already persisted parts into the final artifact without buffering it in memory. */
export async function assembleUploadParts(
  storageKey: string,
  sessionId: string,
  partNumbers: number[],
): Promise<{ sizeBytes: number; sha256: string }> {
  const abs = absolutePathFor(storageKey)
  await mkdir(path.dirname(abs), { recursive: true })
  const hash = createHash('sha256')
  const out = createWriteStream(abs)
  let sizeBytes = 0

  try {
    for (const partNumber of partNumbers) {
      const part = createReadStream(
        absolutePathFor(uploadPartStorageKey(sessionId, partNumber)),
      )
      for await (const chunk of part) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        sizeBytes += data.length
        hash.update(data)
        if (!out.write(data)) await once(out, 'drain')
      }
    }
    out.end()
    await finished(out)
  } catch (error) {
    out.destroy()
    await unlink(abs).catch(() => undefined)
    throw error
  }

  return { sizeBytes, sha256: hash.digest('hex') }
}

/** Remove the temporary directory for one explicitly identified resumable upload. */
export async function deleteUploadSessionFiles(sessionId: string): Promise<void> {
  const key = path.posix.join('_uploads', sessionId)
  await rm(absolutePathFor(key), { recursive: true, force: true }).catch((error) => {
    console.error('[storage] delete resumable upload failed', sessionId, error)
  })
}

export async function listUploadPartNumbers(sessionId: string): Promise<number[]> {
  const directory = absolutePathFor(path.posix.join('_uploads', sessionId, 'parts'))
  try {
    const names = await readdir(directory)
    return names
      .map((name) => /^([1-9]\d*)\.part$/.exec(name)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number)
      .sort((left, right) => left - right)
  } catch {
    return []
  }
}

export async function saveUploadBuffer(
  storageKey: string,
  data: ArrayBuffer | Buffer,
): Promise<{ sizeBytes: number; sha256: string }> {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const abs = absolutePathFor(storageKey)
  await mkdir(path.dirname(abs), { recursive: true })
  const sha256 = createHash('sha256').update(buf).digest('hex')
  await writeFile(abs, buf)
  return { sizeBytes: buf.length, sha256 }
}

export function openDownloadStream(storageKey: string) {
  const abs = absolutePathFor(storageKey)
  if (!existsSync(abs)) return null
  return createReadStream(abs)
}

/** Best-effort delete of a stored object */
export async function deleteStorageFile(storageKey: string): Promise<void> {
  try {
    const abs = absolutePathFor(storageKey)
    if (existsSync(abs)) await unlink(abs)
  } catch (err) {
    console.error('[storage] delete failed', storageKey, err)
  }
}

/** Read either the legacy filesystem artifact or an S3-compatible object. */
export async function openArtifactDownloadStream(
  storageKey: string,
  storageBackend: string,
) {
  return storageBackend === 's3'
    ? openObjectDownloadStream(storageKey)
    : openDownloadStream(storageKey)
}

/** Delete either legacy filesystem storage or an S3-compatible object. */
export async function deleteArtifactStorageFile(
  storageKey: string,
  storageBackend: string,
) {
  if (storageBackend === 's3') {
    await deleteObject(storageKey)
    return
  }
  await deleteStorageFile(storageKey)
}
