import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'artifact-center-settings'

export interface RetentionPolicy {
  /** Keep at most this many versions per application (0 = unlimited mock). */
  maxVersions: number
  /** Soft-archive deprecated artifacts after this many days. */
  archiveDeprecatedDays: number
  /** Mock storage quota in bytes. */
  storageQuotaBytes: number
  /** Mock used storage in bytes. */
  storageUsedBytes: number
}

interface SettingsState {
  retention: RetentionPolicy
  setRetention: (patch: Partial<RetentionPolicy>) => void
}

const DEFAULT_RETENTION: RetentionPolicy = {
  maxVersions: 20,
  archiveDeprecatedDays: 90,
  storageQuotaBytes: 1024 ** 4, // 1 TB
  storageUsedBytes: 128 * 1024 ** 3, // 128 GB
}

/** Retention / storage preferences (still local until backend policy API). */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      retention: DEFAULT_RETENTION,
      setRetention: (patch) =>
        set((s) => ({
          retention: { ...s.retention, ...patch },
        })),
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        retention: s.retention,
      }),
      // Drop legacy `members` from older persisted blobs
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...current,
          retention: p.retention ?? current.retention,
        }
      },
    },
  ),
)
