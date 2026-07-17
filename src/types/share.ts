import type { Artifact } from '@/types/artifact'

/**
 * Share download link — capability URL for internal distribution.
 *
 * Recipient opens `/d/:token`, sees what they get, then downloads.
 * `latest` always resolves current recommended build for the app.
 * `artifact` pins a specific version forever (until expiry/revoke).
 */
export type ShareMode = 'latest' | 'artifact'

export interface ShareLink {
  id: string
  /** Public path segment — unguessable enough for demo */
  token: string
  applicationId: string
  mode: ShareMode
  /** Required when mode === 'artifact' */
  artifactId?: string
  createdAt: string
  /** ISO expiry; null = does not expire */
  expiresAt: string | null
  createdBy: string
}

export type CreateShareInput = {
  applicationId: string
  /** For error pages / token display */
  applicationName?: string
  mode: ShareMode
  artifactId?: string
  /** Days until expiry; 0 or omit = no expiry */
  expiresInDays?: number
  createdBy?: string
  /**
   * When mode is artifact, pass the full row so the token can embed a snapshot
   * (required for cross-browser pin shares without a shared artifact DB).
   */
  artifact?: Artifact
}
