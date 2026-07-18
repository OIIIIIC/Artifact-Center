/**
 * Share helpers. Link creation is server-side; URL builder stays client-local.
 */

export function shareUrlForToken(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/d/${token}`
}
