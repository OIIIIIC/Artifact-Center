/**
 * Keep credentials and capability URLs out of Playwright diagnostics. The
 * suite still keeps the original values in memory long enough to exercise the
 * real browser flow; this module is only for material written to a reporter.
 */
export class SensitiveValueRedactor {
  private readonly values = new Set<string>()

  add(value: string | undefined) {
    if (value) this.values.add(value)
  }

  redact(value: string): string {
    let result = value
    for (const secret of [...this.values].sort(
      (left, right) => right.length - left.length,
    )) {
      result = result.replaceAll(secret, '[redacted]')
      result = result.replaceAll(encodeURIComponent(secret), '[redacted]')
    }
    return redactText(result)
  }
}

/** Redact capability-shaped paths and common Playwright/API diagnostic forms. */
export function redactText(value: string): string {
  let result = value
  const environmentPassword = process.env.E2E_AUTH_PASSWORD
  if (environmentPassword) {
    result = result.replaceAll(environmentPassword, '[redacted]')
    result = result.replaceAll(encodeURIComponent(environmentPassword), '[redacted]')
  }
  return result
    .replace(/\/d\/[^/?\s"'`\\]+/g, '/d/[redacted]')
    .replace(/\/downloads\/[^/?\s"'`\\]+/g, '/downloads/[redacted]')
    .replace(/\/api\/public\/shares\/[^/?\s"'`\\]+/g, '/api/public/shares/[redacted]')
    .replace(/\bBearer\s+[^\s"',;]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2}\b/g, '[redacted-jwt]')
    .replace(
      /((?:token|ticket|password|authorization|accessToken|shareToken)\s*[:=]\s*["']?)[^\s"'&,}]+/gi,
      '$1[redacted]',
    )
    .replace(/([?&](?:token|ticket|password)=)[^\s&#]+/gi, '$1[redacted]')
    .replace(
      /\b(?:fill|type|pressSequentially)\(\s*(["']).*?\1\s*\)/gis,
      'input([redacted])',
    )
}

export function safeErrorMessage(
  error: unknown,
  redactor: SensitiveValueRedactor,
): string {
  return redactor.redact(error instanceof Error ? error.message : String(error))
}
