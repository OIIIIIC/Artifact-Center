import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { checkPassword } from '@/lib/password'
import type { AuthErrorCode, AuthUser, LoginCredentials } from '@/types/auth'

const STORAGE_KEY = 'artifact-center-auth'

export type UpdateProfileInput = {
  name: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  /**
   * Mock credential store: email → password (plain for demo only).
   * Real product would use server-side hashing.
   */
  credentials: Record<string, string>
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ ok: true } | { ok: false; code: AuthErrorCode }>
  updateProfile: (
    input: UpdateProfileInput,
  ) => { ok: true } | { ok: false; code: AuthErrorCode }
  updateAvatar: (
    avatarUrl: string | null,
  ) => { ok: true } | { ok: false; code: AuthErrorCode }
  changePassword: (input: {
    current: string
    next: string
    confirm: string
  }) => { ok: true } | { ok: false; code: AuthErrorCode; issues?: string[] }
  /** Admin-only: set another user's password (by email). */
  adminResetPassword: (input: {
    email: string
    next: string
    confirm: string
  }) => { ok: true } | { ok: false; code: AuthErrorCode }
  logout: () => void
  isAuthenticated: () => boolean
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'User'
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function emailKey(email: string): string {
  return email.trim().toLowerCase()
}

/** Seed demo password (must pass policy). */
const DEMO_EMAIL = 'demo@enterprise.local'
const DEMO_PASSWORD = 'Demo@2026'

const DEFAULT_CREDENTIALS: Record<string, string> = {
  [DEMO_EMAIL]: DEMO_PASSWORD,
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      credentials: { ...DEFAULT_CREDENTIALS },
      isAuthenticated: () => Boolean(get().user),
      logout: () => set({ user: null }),

      updateProfile: ({ name, email }) => {
        const current = get().user
        if (!current) return { ok: false, code: 'no_user' }
        const nextName = name.trim()
        const nextEmail = email.trim()
        if (!nextName || !nextEmail) return { ok: false, code: 'empty' }
        if (!isValidEmail(nextEmail)) return { ok: false, code: 'invalid_email' }

        const oldKey = emailKey(current.email)
        const newKey = emailKey(nextEmail)
        const credentials = { ...get().credentials }
        if (oldKey !== newKey && credentials[oldKey]) {
          credentials[newKey] = credentials[oldKey]
          delete credentials[oldKey]
        }

        set({
          credentials,
          user: {
            ...current,
            name: nextName,
            email: nextEmail,
          },
        })
        return { ok: true }
      },

      updateAvatar: (avatarUrl) => {
        const current = get().user
        if (!current) return { ok: false, code: 'no_user' }
        set({
          user: {
            ...current,
            avatarUrl: avatarUrl || null,
          },
        })
        return { ok: true }
      },

      changePassword: ({ current, next, confirm }) => {
        const user = get().user
        if (!user) return { ok: false, code: 'no_user' }
        const key = emailKey(user.email)
        const stored = get().credentials[key]
        if (stored && stored !== current) {
          return { ok: false, code: 'wrong_password' }
        }
        if (!stored && !current) {
          return { ok: false, code: 'empty' }
        }

        const check = checkPassword(next, { current, confirm })
        if (check.issues.includes('mismatch')) {
          return { ok: false, code: 'mismatch' }
        }
        if (check.issues.includes('same_as_current')) {
          return { ok: false, code: 'same_as_current' }
        }
        if (!check.ok) {
          return { ok: false, code: 'weak_password', issues: check.issues }
        }

        set((s) => ({
          credentials: { ...s.credentials, [key]: next },
        }))
        return { ok: true }
      },

      adminResetPassword: ({ email, next, confirm }) => {
        const actor = get().user
        if (!actor) return { ok: false, code: 'no_user' }
        if (actor.role !== 'admin') return { ok: false, code: 'forbidden' }

        const key = emailKey(email)
        if (!key) return { ok: false, code: 'empty' }

        const check = checkPassword(next, { confirm })
        if (check.issues.includes('mismatch')) {
          return { ok: false, code: 'mismatch' }
        }
        if (!check.ok) {
          return { ok: false, code: 'weak_password', issues: check.issues }
        }

        set((s) => ({
          credentials: { ...s.credentials, [key]: next },
        }))
        return { ok: true }
      },

      login: async ({ email, password }) => {
        const trimmed = email.trim()
        if (!trimmed || !password) {
          return { ok: false, code: 'empty' }
        }
        if (!isValidEmail(trimmed)) {
          return { ok: false, code: 'invalid_email' }
        }

        await new Promise((r) => setTimeout(r, 450))

        const key = emailKey(trimmed)
        const stored = get().credentials[key]

        if (stored) {
          if (stored !== password) {
            return { ok: false, code: 'wrong_password' }
          }
        } else {
          // First login for new email: require non-weak password, then save
          const check = checkPassword(password)
          if (!check.ok) {
            return { ok: false, code: 'weak_password' }
          }
          set((s) => ({
            credentials: { ...s.credentials, [key]: password },
          }))
        }

        const prev = get().user
        const keepAvatar =
          prev && emailKey(prev.email) === key ? prev.avatarUrl : undefined

        const user: AuthUser = {
          id: `user-${key}`,
          email: trimmed,
          name:
            key === DEMO_EMAIL
              ? 'Demo User'
              : prev && emailKey(prev.email) === key
                ? prev.name
                : displayNameFromEmail(trimmed),
          role: key.includes('admin') || key === DEMO_EMAIL ? 'admin' : 'maintainer',
          avatarUrl: keepAvatar ?? null,
        }
        set({ user })
        return { ok: true }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        user: s.user,
        credentials: s.credentials,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AuthState>
        return {
          ...current,
          ...p,
          credentials: {
            ...DEFAULT_CREDENTIALS,
            ...(p.credentials ?? {}),
          },
        }
      },
    },
  ),
)

export { DEMO_EMAIL, DEMO_PASSWORD }
