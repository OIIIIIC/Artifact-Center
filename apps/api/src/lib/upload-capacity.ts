import { env } from '../env.js'
import { getStorageDiskSpace } from './storage.js'
import { ensureRetentionSettings, getStorageUsedBytes } from './retention.js'

type CapacityPolicy = {
  storageQuotaBytes: number
}

type DiskSpace = {
  freeBytes: number
}

export type UploadCapacityRejection =
  'storage_quota_exceeded' | 'storage_low_disk' | 'storage_unavailable'

export type UploadCapacityReservation =
  | { accepted: true; release: () => void }
  | { accepted: false; reason: UploadCapacityRejection }

export type UploadCapacityDependencies = {
  getPolicy: () => Promise<CapacityPolicy>
  getUsedBytes: () => Promise<number>
  getDiskSpace: () => Promise<DiskSpace | null>
  minFreeBytes: number
}

/**
 * 在单个 API 进程内为待写入文件保留容量，避免并发上传绕过同一次用量检查。
 * 多实例部署仍需要共享的数据库/存储预留机制；当前实现会在账本中明确记录该边界。
 */
export function createUploadCapacityGate(deps: UploadCapacityDependencies) {
  let reservedBytes = 0

  return {
    async reserve(incomingBytes: number): Promise<UploadCapacityReservation> {
      const [policy, usedBytes, diskSpace] = await Promise.all([
        deps.getPolicy(),
        deps.getUsedBytes(),
        deps.getDiskSpace(),
      ])

      if (!diskSpace) {
        return { accepted: false, reason: 'storage_unavailable' }
      }

      const projectedBytes = usedBytes + reservedBytes + incomingBytes
      if (projectedBytes > policy.storageQuotaBytes) {
        return { accepted: false, reason: 'storage_quota_exceeded' }
      }

      if (diskSpace.freeBytes - reservedBytes < incomingBytes + deps.minFreeBytes) {
        return { accepted: false, reason: 'storage_low_disk' }
      }

      reservedBytes += incomingBytes
      let released = false
      return {
        accepted: true,
        release: () => {
          if (released) return
          released = true
          reservedBytes = Math.max(0, reservedBytes - incomingBytes)
        },
      }
    },
  }
}

const uploadCapacityGate = createUploadCapacityGate({
  getPolicy: ensureRetentionSettings,
  getUsedBytes: getStorageUsedBytes,
  getDiskSpace: getStorageDiskSpace,
  minFreeBytes: env.storageMinFreeBytes,
})

export function reserveUploadCapacity(incomingBytes: number) {
  return uploadCapacityGate.reserve(incomingBytes)
}
