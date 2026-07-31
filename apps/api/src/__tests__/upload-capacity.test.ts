import { describe, expect, it } from 'vitest'

import { createUploadCapacityGate } from '../lib/upload-capacity.js'

function createGate(options?: {
  quota?: number
  used?: number
  free?: number | null
  minFree?: number
}) {
  return createUploadCapacityGate({
    getPolicy: async () => ({ storageQuotaBytes: options?.quota ?? 100 }),
    getUsedBytes: async () => options?.used ?? 0,
    getDiskSpace: async () =>
      options?.free === null ? null : { freeBytes: options?.free ?? 1_000 },
    minFreeBytes: options?.minFree ?? 10,
  })
}

describe('上传容量门禁', () => {
  it('超过硬配额时拒绝写入', async () => {
    const result = await createGate({ quota: 100, used: 80 }).reserve(21)

    expect(result).toEqual({
      accepted: false,
      reason: 'storage_quota_exceeded',
    })
  })

  it('低于最小磁盘余量时拒绝写入', async () => {
    const result = await createGate({ free: 30, minFree: 10 }).reserve(21)

    expect(result).toEqual({ accepted: false, reason: 'storage_low_disk' })
  })

  it('进程内预留会计入并发上传，释放后可继续使用', async () => {
    const gate = createGate({ quota: 100, used: 40 })
    const first = await gate.reserve(50)
    const blocked = await gate.reserve(20)

    expect(first.accepted).toBe(true)
    expect(blocked).toEqual({
      accepted: false,
      reason: 'storage_quota_exceeded',
    })

    if (first.accepted) first.release()
    const retry = await gate.reserve(20)
    expect(retry.accepted).toBe(true)
  })

  it('无法取得磁盘数据时拒绝上传', async () => {
    const result = await createGate({ free: null }).reserve(1)

    expect(result).toEqual({ accepted: false, reason: 'storage_unavailable' })
  })
})
