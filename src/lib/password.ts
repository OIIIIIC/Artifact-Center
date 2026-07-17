/**
 * Client-side password policy (mock + future API parity).
 * Weak passwords are always rejected.
 */

const COMMON_WEAK = new Set(
  [
    'password',
    'password1',
    'password123',
    '12345678',
    '123456789',
    '1234567890',
    'qwerty123',
    'qwertyui',
    'admin123',
    'welcome1',
    'letmein1',
    'abc12345',
    'iloveyou',
    'monkey12',
    'dragon12',
    'master12',
    'demo',
    'demo1234',
    'passw0rd',
    'changeme',
    '00000000',
    '11111111',
    '88888888',
  ].map((s) => s.toLowerCase()),
)

export type PasswordIssue =
  | 'too_short'
  | 'too_long'
  | 'common'
  | 'no_letter'
  | 'no_digit'
  | 'only_repeat'
  | 'sequential'
  | 'mismatch'
  | 'same_as_current'
  | 'empty'

export type PasswordStrength = 'weak' | 'fair' | 'strong'

export interface PasswordCheck {
  ok: boolean
  strength: PasswordStrength
  issues: PasswordIssue[]
  /** 0–100 for progress UI */
  score: number
}

const MIN = 8
const MAX = 72

function isSequential(s: string): boolean {
  const lower = s.toLowerCase()
  if (lower.length < 4) return false
  let asc = 0
  let desc = 0
  for (let i = 1; i < lower.length; i++) {
    const d = lower.charCodeAt(i) - lower.charCodeAt(i - 1)
    if (d === 1) {
      asc += 1
      if (asc >= 3) return true
      desc = 0
    } else if (d === -1) {
      desc += 1
      if (desc >= 3) return true
      asc = 0
    } else {
      asc = 0
      desc = 0
    }
  }
  return false
}

function isOnlyRepeat(s: string): boolean {
  return /^(.)\1+$/.test(s)
}

/**
 * Validate password strength. `ok` is false when password is weak / invalid.
 */
export function checkPassword(
  password: string,
  opts?: { current?: string; confirm?: string },
): PasswordCheck {
  const issues: PasswordIssue[] = []
  const pw = password

  if (!pw) {
    return { ok: false, strength: 'weak', issues: ['empty'], score: 0 }
  }
  if (pw.length < MIN) issues.push('too_short')
  if (pw.length > MAX) issues.push('too_long')
  if (COMMON_WEAK.has(pw.toLowerCase())) issues.push('common')
  if (!/[a-zA-Z\u4e00-\u9fff]/.test(pw)) issues.push('no_letter')
  if (!/\d/.test(pw)) issues.push('no_digit')
  if (isOnlyRepeat(pw)) issues.push('only_repeat')
  if (isSequential(pw)) issues.push('sequential')
  if (opts?.confirm !== undefined && opts.confirm !== pw) {
    issues.push('mismatch')
  }
  if (opts?.current !== undefined && opts.current === pw) {
    issues.push('same_as_current')
  }

  // Score for meter (only when base format is ok-ish)
  let score = 0
  if (pw.length >= MIN) score += 25
  if (pw.length >= 12) score += 15
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 15
  if (/\d/.test(pw)) score += 15
  if (/[^a-zA-Z0-9]/.test(pw)) score += 20
  if (pw.length >= 16) score += 10
  score = Math.min(100, score)

  // Hard reject conditions always weak
  const hardFail = issues.some((i) =>
    [
      'too_short',
      'too_long',
      'common',
      'no_letter',
      'no_digit',
      'only_repeat',
      'sequential',
      'empty',
    ].includes(i),
  )

  let strength: PasswordStrength = 'weak'
  if (!hardFail) {
    if (score >= 70 && /[^a-zA-Z0-9]/.test(pw)) strength = 'strong'
    else if (score >= 45) strength = 'fair'
    else strength = 'weak'
  }

  // Policy: must be at least fair
  const ok =
    !hardFail &&
    strength !== 'weak' &&
    !issues.includes('mismatch') &&
    !issues.includes('same_as_current')

  if (!ok && !hardFail && strength === 'weak' && !issues.includes('common')) {
    // mark weak via score without extra issue if none
  }

  return { ok, strength: hardFail ? 'weak' : strength, issues, score }
}

export const PASSWORD_MIN_LENGTH = MIN
