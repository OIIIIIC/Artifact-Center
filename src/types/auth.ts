export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'maintainer' | 'viewer'
  /** data URL or remote URL; optional */
  avatarUrl?: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export type AuthErrorCode =
  | 'empty'
  | 'invalid_email'
  | 'no_user'
  | 'wrong_password'
  | 'weak_password'
  | 'mismatch'
  | 'same_as_current'
  | 'forbidden'
  | 'invalid_image'
  | 'image_too_large'
  | 'network'
