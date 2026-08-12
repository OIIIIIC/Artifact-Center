import { Readable } from 'node:stream'

import { describe, expect, it } from 'vitest'

import {
  absolutePathFor,
  assembleUploadParts,
  deleteStorageFile,
  deleteUploadSessionFiles,
  saveUploadPart,
} from './storage.js'

describe('分片制品存储', () => {
  it('按顺序合并磁盘分片并校验完整 SHA-256', async () => {
    const sessionId = 'a667fa49-8780-4fd3-bff3-ec50d56ba5cc'
    const storageKey = 'test-resumable/assembled-artifact.zip'
    try {
      await saveUploadPart(sessionId, 1, Readable.from(['artifact ']))
      await saveUploadPart(sessionId, 2, Readable.from(['content']))

      const assembled = await assembleUploadParts(storageKey, sessionId, [1, 2])

      expect(assembled.sizeBytes).toBe(16)
      expect(assembled.sha256).toBe(
        '42bd420cc2f99e68e60005fa7c28fc2f60e4e04ee160d9dd3b98e72fc2954f98',
      )
      await expect(
        import('node:fs/promises').then(({ readFile }) =>
          readFile(absolutePathFor(storageKey), 'utf8'),
        ),
      ).resolves.toBe('artifact content')
    } finally {
      await deleteStorageFile(storageKey)
      await deleteUploadSessionFiles(sessionId)
    }
  })
})
