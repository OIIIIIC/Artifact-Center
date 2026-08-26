type AvatarUser = {
  id: string
  avatarUrl?: string | null
}

const AVATAR_LIBRARY_ROOT = '/avatar-library'

/** Curated 3D avatar assets packaged with the application for offline use. */
export const DEFAULT_AVATAR_URLS = Array.from(
  { length: 33 },
  (_, index) => `${AVATAR_LIBRARY_ROOT}/avatar-${String(index + 1).padStart(2, '0')}.jpg`,
)

function hashId(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0
  }
  return hash >>> 0
}

/** The same user id always receives the same built-in avatar. */
export function getDefaultAvatarUrl(userId: string): string {
  return DEFAULT_AVATAR_URLS[hashId(userId) % DEFAULT_AVATAR_URLS.length]
}

function isLegacyGeneratedAvatar(url: string): boolean {
  return url.startsWith('data:image/svg+xml')
}

/** Prefer a selected/uploaded image, otherwise use the curated local avatar library. */
export function getUserAvatarUrl(user: AvatarUser): string {
  const avatarUrl = user.avatarUrl?.trim()
  return avatarUrl && !isLegacyGeneratedAvatar(avatarUrl)
    ? avatarUrl
    : getDefaultAvatarUrl(user.id)
}
