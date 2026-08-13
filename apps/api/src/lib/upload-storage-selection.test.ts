import { describe, expect, it, vi } from 'vitest'

import { selectUploadStorage } from './upload-storage-selection.js'

describe('selectUploadStorage', () => {
  const localStorageKey = 'artifacts/app-1/package.apk'
  const objectStorageKey = 'artifacts/app-1/object-package.apk'

  it('uses local resumable storage when direct multipart initialization fails', async () => {
    const error = new Error('MinIO temporarily unavailable')
    const onDirectUploadUnavailable = vi.fn()

    await expect(
      selectUploadStorage({
        objectStorageEnabled: true,
        localStorageKey,
        objectStorageKey,
        createObjectMultipartUpload: vi.fn().mockRejectedValue(error),
        onDirectUploadUnavailable,
      }),
    ).resolves.toEqual({
      storageBackend: 'local',
      storageKey: localStorageKey,
      objectUploadId: null,
    })

    expect(onDirectUploadUnavailable).toHaveBeenCalledWith(error)
  })

  it('uses direct object storage after multipart initialization succeeds', async () => {
    await expect(
      selectUploadStorage({
        objectStorageEnabled: true,
        localStorageKey,
        objectStorageKey,
        createObjectMultipartUpload: vi.fn().mockResolvedValue('upload-1'),
      }),
    ).resolves.toEqual({
      storageBackend: 's3',
      storageKey: objectStorageKey,
      objectUploadId: 'upload-1',
    })
  })
})
