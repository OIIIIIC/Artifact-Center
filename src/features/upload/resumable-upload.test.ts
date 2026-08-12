import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  apiCompleteResumableUpload,
  apiCreateResumableUpload,
  apiUploadDirectResumablePart,
  apiUploadResumablePart,
} from '@/services/api'
import { uploadArtifactResumable } from './resumable-upload'

vi.mock('@/services/api', () => ({
  apiCreateResumableUpload: vi.fn(),
  apiUploadResumablePart: vi.fn(),
  apiUploadDirectResumablePart: vi.fn(),
  apiCompleteResumableUpload: vi.fn(),
}))

describe('分片上传', () => {
  afterEach(() => vi.clearAllMocks())

  it('恢复上传时跳过已完成分片，并汇总进度后完成发布', async () => {
    vi.mocked(apiCreateResumableUpload).mockResolvedValue({
      uploadId: 'upload-1',
      partSize: 3,
      partCount: 3,
      uploadedParts: [2],
      expiresAt: '2026-08-13T00:00:00.000Z',
      transport: 'proxy',
    })
    vi.mocked(apiUploadResumablePart).mockResolvedValue()
    vi.mocked(apiCompleteResumableUpload).mockResolvedValue({ id: 'artifact-1' } as never)
    const progress: number[] = []

    await uploadArtifactResumable({
      appId: 'app-1',
      file: new File(['12345678'], 'artifact.apk', { lastModified: 1 }),
      fields: { version: '1.0.0', platform: 'android' },
      onProgress: ({ loadedBytes }) => progress.push(loadedBytes),
    })

    expect(apiUploadResumablePart).toHaveBeenCalledTimes(2)
    expect(
      vi
        .mocked(apiUploadResumablePart)
        .mock.calls.map((call) => call[1])
        .sort(),
    ).toEqual([1, 3])
    expect(progress.at(-1)).toBe(8)
    expect(apiCompleteResumableUpload).toHaveBeenCalledWith('upload-1')
  })

  it('对象存储直传时使用预签名分片上传', async () => {
    vi.mocked(apiCreateResumableUpload).mockResolvedValue({
      uploadId: 'upload-direct',
      partSize: 3,
      partCount: 1,
      uploadedParts: [],
      expiresAt: '2026-08-13T00:00:00.000Z',
      transport: 'direct',
    })
    vi.mocked(apiUploadDirectResumablePart).mockResolvedValue()
    vi.mocked(apiCompleteResumableUpload).mockResolvedValue({
      id: 'artifact-direct',
    } as never)

    await uploadArtifactResumable({
      appId: 'app-1',
      file: new File(['123'], 'artifact.apk', { lastModified: 1 }),
      fields: { version: '1.0.0', platform: 'android' },
    })

    expect(apiUploadDirectResumablePart).toHaveBeenCalledTimes(1)
    expect(apiUploadResumablePart).not.toHaveBeenCalled()
  })
})
