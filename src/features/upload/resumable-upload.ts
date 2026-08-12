import {
  apiCompleteResumableUpload,
  apiCreateResumableUpload,
  apiUploadDirectResumablePart,
  apiUploadResumablePart,
  type UploadArtifactFields,
} from '@/services/api'
import { ApiError, type UploadProgress } from '@/services/http'
import type { Artifact } from '@/types/artifact'

const CONCURRENCY = 4
const MAX_PART_ATTEMPTS = 3

export async function resumableUploadKey(file: File, fields: UploadArtifactFields) {
  const source = [
    'v1',
    file.name,
    file.size,
    file.lastModified,
    fields.version,
    fields.buildNumber ?? '',
    fields.platform ?? '',
    fields.channel ?? 'stable',
    fields.releaseNotes ?? '',
    fields.markLatest === false ? 'false' : 'true',
  ].join('|')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function isRetryable(error: unknown) {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500
}

function abortError() {
  return new ApiError({
    status: 0,
    code: 'request_aborted',
    message: 'Request was cancelled',
  })
}

async function uploadPartWithRetry(
  uploadId: string,
  partNumber: number,
  blob: Blob,
  onProgress: UploadProgress,
  signal?: AbortSignal,
  direct = false,
) {
  for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw abortError()
    try {
      if (direct) {
        await apiUploadDirectResumablePart(uploadId, partNumber, blob, onProgress, signal)
      } else {
        await apiUploadResumablePart(uploadId, partNumber, blob, onProgress, signal)
      }
      return
    } catch (error) {
      if (signal?.aborted || !isRetryable(error) || attempt === MAX_PART_ATTEMPTS)
        throw error
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(resolve, 250 * 2 ** (attempt - 1))
        signal?.addEventListener(
          'abort',
          () => {
            window.clearTimeout(timeout)
            reject(abortError())
          },
          { once: true },
        )
      })
    }
  }
}

/**
 * Upload an artifact as four concurrent chunks. Reinvoking it with the same file and
 * release metadata resumes its existing server session and skips committed chunks.
 */
export async function uploadArtifactResumable({
  appId,
  file,
  fields,
  onProgress,
  signal,
}: {
  appId: string
  file: File
  fields: UploadArtifactFields
  onProgress?: UploadProgress
  signal?: AbortSignal
}): Promise<Artifact> {
  const upload = await apiCreateResumableUpload(appId, file, {
    ...fields,
    resumeKey: await resumableUploadKey(file, fields),
  })
  const completed = new Set(upload.uploadedParts)
  const partSizes = Array.from({ length: upload.partCount }, (_, index) =>
    Math.min(upload.partSize, file.size - index * upload.partSize),
  )
  const transferred = new Map<number, number>()
  for (const partNumber of completed)
    transferred.set(partNumber, partSizes[partNumber - 1] ?? 0)
  const report = () => {
    const loadedBytes = [...transferred.values()].reduce(
      (total, value) => total + value,
      0,
    )
    onProgress?.({
      progress: Math.round((loadedBytes / file.size) * 100),
      loadedBytes,
      totalBytes: file.size,
    })
  }
  report()

  const pendingParts = partSizes
    .map((_, index) => index + 1)
    .filter((partNumber) => !completed.has(partNumber))
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < pendingParts.length) {
      if (signal?.aborted) throw abortError()
      const partNumber = pendingParts[nextIndex++]
      const start = (partNumber - 1) * upload.partSize
      const blob = file.slice(start, start + partSizes[partNumber - 1])
      await uploadPartWithRetry(
        upload.uploadId,
        partNumber,
        blob,
        ({ loadedBytes }) => {
          transferred.set(partNumber, loadedBytes)
          report()
        },
        signal,
        upload.transport === 'direct',
      )
      transferred.set(partNumber, blob.size)
      report()
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pendingParts.length) }, worker),
  )
  return apiCompleteResumableUpload(upload.uploadId)
}
