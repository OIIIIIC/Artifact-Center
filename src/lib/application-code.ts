export const APPLICATION_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeApplicationCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
}

/** Prefer a readable English name; fall back to the package identifier for Chinese names. */
export function suggestApplicationCode(name: string, packageName: string): string {
  const fromName = normalizeApplicationCode(name)
  if (fromName) return fromName
  const packageTail =
    packageName
      .trim()
      .split(/[./\\]/)
      .filter(Boolean)
      .at(-1) ?? ''
  return normalizeApplicationCode(packageTail)
}

export function isApplicationCode(value: string): boolean {
  return value.length <= 48 && APPLICATION_CODE_PATTERN.test(value)
}
