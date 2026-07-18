/**
 * Server-side password policy (aligned with frontend checkPassword minimums).
 */

export type PasswordPolicyFail = {
  ok: false
  code: 'weak_password'
  message: string
}

export type PasswordPolicyOk = { ok: true }

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
  return { ok: true }
}
