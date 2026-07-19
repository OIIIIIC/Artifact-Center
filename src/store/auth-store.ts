import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { checkPassword } from '@/lib/password'
import { apiChangePassword, apiLogin, apiMe, apiUpdateProfile } from '@/services/api'
import { ApiError, setUnauthorizedHandler } from '@/services/http'
import { setAccessToken } from '@/services/session'
import type { AuthErrorCode, AuthUser, LoginCredentials } from '@/types/auth'

const STORAGE_KEY = 'artifact-center-auth'

export type UpdateProfileInput = {
  name: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  bootstrapped: boolean
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ ok: true } | { ok: false; code: AuthErrorCode }>
  /** Validate persisted token with /auth/me */
  bootstrap: () => Promise<void>
  updateProfile: (
    input: UpdateProfileInput,
  ) => Promise<{ ok: true } | { ok: false; code: AuthErrorCode }>
  updateAvatar: (
    avatarUrl: string | null,
  ) => Promise<{ ok: true } | { ok: false; code: AuthErrorCode }>
  changePassword: (input: {
    current: string
    next: string
    confirm: string
  }) => Promise<{ ok: true } | { ok: false; code: AuthErrorCode; issues?: string[] }>
  logout: () => void
  isAuthenticated: () => boolean
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function applySession(token: string, user: AuthUser) {
  setAccessToken(token)
  return { token, user }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      bootstrapped: false,
      isAuthenticated: () => Boolean(get().user && get().token),
      logout: () => {
        setAccessToken(null)
        set({ user: null, token: null })
      },

      bootstrap: async () => {
        const token = get().token
        if (!token) {
          setAccessToken(null)
          set({ bootstrapped: true, user: null })
          return
        }
        setAccessToken(token)
        try {
          const user = await apiMe()
          set({ user, bootstrapped: true })
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setAccessToken(null)
            set({ user: null, token: null, bootstrapped: true })
            return
          }

          // 服务暂时不可用时保留本地会话，由页面查询展示可重试的错误状态。
          set({ bootstrapped: true })
        }
      },

      updateProfile: async ({ name, email }) => {
        const current = get().user
        if (!current) return { ok: false, code: 'no_user' }
        const nextName = name.trim()
        const nextEmail = email.trim()
        if (!nextName || !nextEmail) return { ok: false, code: 'empty' }
        if (!isValidEmail(nextEmail)) return { ok: false, code: 'invalid_email' }

        try {
          const { user, token } = await apiUpdateProfile({
            name: nextName,
            email: nextEmail,
          })
          set(applySession(token, user))
          return { ok: true }
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.code === 'email_taken') return { ok: false, code: 'invalid_email' }
            if (err.code === 'invalid_body') return { ok: false, code: 'empty' }
          }
          return { ok: false, code: 'empty' }
        }
      },

      updateAvatar: async (avatarUrl) => {
        const current = get().user
        if (!current) return { ok: false, code: 'no_user' }
        try {
          const { user, token } = await apiUpdateProfile({
            avatarUrl: avatarUrl || null,
          })
          set(applySession(token, user))
          return { ok: true }
        } catch {
          return { ok: false, code: 'invalid_image' }
        }
      },

      changePassword: async ({ current, next, confirm }) => {
        const user = get().user
        if (!user) return { ok: false, code: 'no_user' }
        if (!current || !next || !confirm) {
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

        try {
          await apiChangePassword({
            currentPassword: current,
            newPassword: next,
          })
          return { ok: true }
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.code === 'wrong_password' || err.status === 401) {
              return { ok: false, code: 'wrong_password' }
            }
            if (err.code === 'same_as_current') {
              return { ok: false, code: 'same_as_current' }
            }
            if (err.code === 'weak_password') {
              return { ok: false, code: 'weak_password' }
            }
          }
          return { ok: false, code: 'empty' }
        }
      },

      login: async ({ identifier, password }) => {
        const trimmed = identifier.trim()
        if (!trimmed || !password) {
          return { ok: false, code: 'empty' }
        }

        try {
          const { token, user } = await apiLogin({ identifier: trimmed, password })
          set(applySession(token, user))
          return { ok: true }
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.code === 'invalid_credentials' || err.status === 401) {
              return { ok: false, code: 'wrong_password' }
            }
          }
          return { ok: false, code: 'network' }
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        user: s.user,
        token: s.token,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AuthState>
        const token = p.token ?? null
        if (token) setAccessToken(token)
        return {
          ...current,
          ...p,
          token,
          bootstrapped: false,
        }
      },
    },
  ),
)

// Wire 401 → logout (once)
setUnauthorizedHandler(() => {
  useAuthStore.getState().logout()
})
