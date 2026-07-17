import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  MEMBER_ROLES,
  SEED_MEMBERS,
  type MemberRole,
  type TeamMember,
} from '@/features/settings/mock-members'

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

export type AddMemberInput = {
  name: string
  email: string
  role: MemberRole
}

export type MemberActionError =
  'empty' | 'invalid_email' | 'duplicate' | 'not_found' | 'last_admin' | 'invalid_role'

interface SettingsState {
  members: TeamMember[]
  retention: RetentionPolicy
  setMemberRole: (
    id: string,
    role: MemberRole,
  ) => { ok: true } | { ok: false; code: MemberActionError }
  addMember: (
    input: AddMemberInput,
  ) => { ok: true; member: TeamMember } | { ok: false; code: MemberActionError }
  removeMember: (id: string) => { ok: true } | { ok: false; code: MemberActionError }
  setRetention: (patch: Partial<RetentionPolicy>) => void
  resetMembers: () => void
}

const DEFAULT_RETENTION: RetentionPolicy = {
  maxVersions: 20,
  archiveDeprecatedDays: 90,
  storageQuotaBytes: 1024 ** 4, // 1 TB
  storageUsedBytes: 128 * 1024 ** 3, // 128 GB
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function adminCount(members: TeamMember[]): number {
  return members.filter((m) => m.role === 'admin').length
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      members: SEED_MEMBERS,
      retention: DEFAULT_RETENTION,
      setMemberRole: (id, role) => {
        if (!MEMBER_ROLES.includes(role)) {
          return { ok: false, code: 'invalid_role' }
        }
        const members = get().members
        const target = members.find((m) => m.id === id)
        if (!target) return { ok: false, code: 'not_found' }
        if (target.role === 'admin' && role !== 'admin' && adminCount(members) <= 1) {
          return { ok: false, code: 'last_admin' }
        }
        set({
          members: members.map((m) => (m.id === id ? { ...m, role } : m)),
        })
        return { ok: true }
      },
      addMember: ({ name, email, role }) => {
        const nextName = name.trim()
        const nextEmail = email.trim().toLowerCase()
        if (!nextName || !nextEmail) return { ok: false, code: 'empty' }
        if (!isValidEmail(nextEmail)) return { ok: false, code: 'invalid_email' }
        if (!MEMBER_ROLES.includes(role)) {
          return { ok: false, code: 'invalid_role' }
        }
        const members = get().members
        if (members.some((m) => m.email.toLowerCase() === nextEmail)) {
          return { ok: false, code: 'duplicate' }
        }
        const member: TeamMember = {
          id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name: nextName,
          email: nextEmail,
          role,
        }
        set({ members: [...members, member] })
        return { ok: true, member }
      },
      removeMember: (id) => {
        const members = get().members
        const target = members.find((m) => m.id === id)
        if (!target) return { ok: false, code: 'not_found' }
        if (target.role === 'admin' && adminCount(members) <= 1) {
          return { ok: false, code: 'last_admin' }
        }
        set({ members: members.filter((m) => m.id !== id) })
        return { ok: true }
      },
      setRetention: (patch) =>
        set((s) => ({
          retention: { ...s.retention, ...patch },
        })),
      resetMembers: () => set({ members: SEED_MEMBERS }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        members: s.members,
        retention: s.retention,
      }),
    },
  ),
)
