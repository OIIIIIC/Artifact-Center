import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { encodeShareToken } from '@/features/share/share-token'
import type { CreateShareInput, ShareLink } from '@/types/share'

interface ShareState {
  /** Creator-side history (optional; resolution uses the self-contained token). */
  links: ShareLink[]
  createLink: (input: CreateShareInput) => ShareLink
  getByToken: (token: string) => ShareLink | undefined
  revoke: (id: string) => void
}

export const useShareStore = create<ShareState>()(
  persist(
    (set, get) => ({
      links: [],
      createLink: (input) => {
        const now = Date.now()
        const days = input.expiresInDays
        const expiresAt =
          days != null && days > 0
            ? new Date(now + days * 24 * 60 * 60 * 1000).toISOString()
            : null

        if (input.mode === 'artifact' && !input.artifactId) {
          throw new Error('artifactId required for artifact share')
        }

        const createdBy = input.createdBy?.trim() || 'Demo User'

        /** Token embeds app + pin snapshot + expiry + sharer — works across browsers. */
        const token = encodeShareToken({
          applicationId: input.applicationId,
          applicationName: input.applicationName,
          mode: input.mode,
          artifactId: input.artifactId ?? input.artifact?.id,
          expiresAt,
          createdBy,
          artifactSnapshot: input.mode === 'artifact' ? input.artifact : undefined,
        })

        const link: ShareLink = {
          id: `share-${now.toString(36)}`,
          token,
          applicationId: input.applicationId,
          mode: input.mode,
          artifactId: input.mode === 'artifact' ? input.artifactId : undefined,
          createdAt: new Date(now).toISOString(),
          expiresAt,
          createdBy,
        }

        set((s) => ({ links: [link, ...s.links] }))
        return link
      },
      getByToken: (token) => get().links.find((l) => l.token === token),
      revoke: (id) => set((s) => ({ links: s.links.filter((l) => l.id !== id) })),
    }),
    { name: 'artifact-center-shares' },
  ),
)

export function shareUrlForToken(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/d/${token}`
}

export function isShareExpired(link: ShareLink, now = Date.now()): boolean {
  if (!link.expiresAt) return false
  return new Date(link.expiresAt).getTime() < now
}
