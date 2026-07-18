import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { mkdir, statfs, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'

import { env } from '../env.js'

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
  const abs = path.resolve(env.storagePath, storageKey)
  if (!abs.startsWith(path.resolve(env.storagePath))) {
    throw new Error('path_traversal')
  }
  return abs
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

  await pipeline(stream, out)
  return { sizeBytes, sha256: hash.digest('hex') }
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
