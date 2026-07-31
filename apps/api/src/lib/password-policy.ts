/**
 * 服务端密码策略必须至少与前端 checkPassword 一致，不能依赖浏览器校验。
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
  ].map((password) => password.toLowerCase()),
)

export type PasswordPolicyFail = {
  ok: false
  code: 'weak_password'
  message: string
}

export type PasswordPolicyOk = { ok: true }

function isSequential(password: string): boolean {
  const normalized = password.toLowerCase()
  let ascending = 0
  let descending = 0

  for (let index = 1; index < normalized.length; index += 1) {
    const difference = normalized.charCodeAt(index) - normalized.charCodeAt(index - 1)
    if (difference === 1) {
      ascending += 1
      descending = 0
      if (ascending >= 3) return true
    } else if (difference === -1) {
      descending += 1
      ascending = 0
      if (descending >= 3) return true
    } else {
      ascending = 0
      descending = 0
    }
  }

  return false
}

function passwordScore(password: string): number {
  let score = 0
  if (password.length >= 8) score += 25
  if (password.length >= 12) score += 15
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 15
  if (/\d/.test(password)) score += 15
  if (/[^a-zA-Z0-9]/.test(password)) score += 20
  if (password.length >= 16) score += 10
  return Math.min(100, score)
}

export function validatePassword(
  password: string,
): PasswordPolicyOk | PasswordPolicyFail {
  if (!password || password.length < 8) {
    return {
      ok: false,
      code: 'weak_password',
      message: 'Password must be at least 8 characters',
    }
  }
  if (password.length > 72) {
    return {
      ok: false,
      code: 'weak_password',
      message: 'Password must be at most 72 characters',
    }
  }
  if (COMMON_WEAK.has(password.toLowerCase())) {
    return {
      ok: false,
      code: 'weak_password',
      message: 'Password is too common',
    }
  }
  if (!/[a-zA-Z\u4e00-\u9fff]/.test(password)) {
    return {
      ok: false,
      code: 'weak_password',
      message: 'Password must contain a letter',
    }
  }
  if (!/\d/.test(password)) {
    return {
      ok: false,
      code: 'weak_password',
      message: 'Password must contain a digit',
    }
  }
  if (/^(.)\1+$/.test(password)) {
    return {
      ok: false,
      code: 'weak_password',
      message: 'Password is too weak (repeated characters)',
    }
  }
  if (isSequential(password)) {
    return {
      ok: false,
      code: 'weak_password',
      message: 'Password must not contain sequential characters',
    }
  }
  if (passwordScore(password) < 45) {
    return {
      ok: false,
      code: 'weak_password',
      message: 'Password must use a stronger character combination',
    }
  }
  return { ok: true }
}
