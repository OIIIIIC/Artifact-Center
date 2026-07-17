import type { ApplicationPlatform } from '@/types/application'
import type { Artifact } from '@/types/artifact'
import type { ShareMode } from '@/types/share'
import type { UploadChannel } from '@/types/upload'

/**
 * Self-contained share token (no server / no shared storage).
 *
 * - latest: app id only — resolve current recommended build on open
 * - pinned: full artifact snapshot — works even if id not in local store
 */
export type SharePayloadV1 = {
  v: 1
  /** applicationId */
  a: string
  /** mode: l = latest, p = pinned artifact */
  m: 'l' | 'p'
  /** artifactId when pinned (optional lookup) */
  i?: string
  /** expiresAt as unix ms */
  e?: number
  /** shared by (display name) */
  b?: string
  /** application display name (for error pages) */
  n?: string
  /** --- pinned snapshot (required for reliable pin shares) --- */
  ver?: string
  bn?: string
  pl?: ApplicationPlatform
  sz?: number
  f?: string
  ch?: UploadChannel
  up?: string
  at?: string
}

export type EncodeShareInput = {
  applicationId: string
  applicationName?: string
  mode: ShareMode
  artifactId?: string
  expiresAt: string | null
  createdBy?: string
  /** Required when mode === 'artifact' for cross-browser pin */
  artifactSnapshot?: Artifact
}

export function encodeShareToken(input: EncodeShareInput): string {
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
  const by = input.createdBy?.trim()
  if (by) payload.b = by.slice(0, 64)
  const appName = input.applicationName?.trim()
  if (appName) payload.n = appName.slice(0, 80)

  if (input.mode === 'artifact' && input.artifactSnapshot) {
    const art = input.artifactSnapshot
    payload.ver = art.version
    payload.bn = art.buildNumber
    payload.pl = art.platform
    payload.sz = art.sizeBytes
    payload.f = art.filename
    payload.ch = art.channel
    payload.up = art.uploader
    payload.at = art.uploadedAt
    payload.i = art.id
  }

  const json = JSON.stringify(payload)
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
    if (data.m === 'p') {
      // Prefer snapshot; allow legacy id-only tokens
      const hasSnapshot =
        typeof data.ver === 'string' &&
        typeof data.f === 'string' &&
        typeof data.pl === 'string'
      if (!hasSnapshot && !data.i) return null
    }
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

/** Rebuild a display Artifact from a pinned snapshot in the token. */
export function artifactFromSnapshot(payload: SharePayloadV1): Artifact | null {
  if (
    typeof payload.ver !== 'string' ||
    typeof payload.f !== 'string' ||
    typeof payload.pl !== 'string'
  ) {
    return null
  }
  return {
    id: payload.i || `snap-${payload.a}-${payload.ver}`,
    applicationId: payload.a,
    version: payload.ver,
    buildNumber: payload.bn || '—',
    platform: payload.pl,
    sizeBytes: typeof payload.sz === 'number' ? payload.sz : 0,
    uploadedAt: payload.at || new Date().toISOString(),
    uploader: payload.up || '—',
    status: 'stable',
    channel: payload.ch,
    releaseNotes: '',
    filename: payload.f,
  }
}
