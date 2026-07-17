import type { ShareMode } from '@/types/share'

/**
 * Self-contained share token (no server / no shared storage).
 * Encoded into the URL so any browser can resolve it.
 *
 * Compact payload keys keep the URL shorter.
 */
export type SharePayloadV1 = {
  v: 1
  /** applicationId */
  a: string
  /** mode: l = latest, p = pinned artifact */
  m: 'l' | 'p'
  /** artifactId when pinned */
  i?: string
  /** expiresAt as unix ms */
  e?: number
}

export function encodeShareToken(input: {
  applicationId: string
  mode: ShareMode
  artifactId?: string
  expiresAt: string | null
}): string {
  const payload: SharePayloadV1 = {
    v: 1,
    a: input.applicationId,
    m: input.mode === 'latest' ? 'l' : 'p',
  }
  if (input.mode === 'artifact' && input.artifactId) {
    payload.i = input.artifactId
  }
  if (input.expiresAt) {
    payload.e = new Date(input.expiresAt).getTime()
  }

  const json = JSON.stringify(payload)
  // UTF-8 safe base64url
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeShareToken(token: string): SharePayloadV1 | null {
  if (!token || token.length < 8) return null
  try {
    const pad = token.length % 4 === 0 ? '' : '='.repeat(4 - (token.length % 4))
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + pad
    const json = decodeURIComponent(escape(atob(b64)))
    const data = JSON.parse(json) as SharePayloadV1
    if (
      data?.v !== 1 ||
      typeof data.a !== 'string' ||
      (data.m !== 'l' && data.m !== 'p')
    ) {
      return null
    }
    if (data.m === 'p' && !data.i) return null
    return data
  } catch {
    return null
  }
}

export function payloadToMode(m: SharePayloadV1['m']): ShareMode {
  return m === 'l' ? 'latest' : 'artifact'
}

export function isPayloadExpired(payload: SharePayloadV1, now = Date.now()): boolean {
  if (payload.e == null) return false
  return payload.e < now
}
