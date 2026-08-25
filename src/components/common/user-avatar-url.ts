import { createAvatar } from '@dicebear/core'
import * as lorelei from '@dicebear/lorelei'
import * as notionists from '@dicebear/notionists'
import * as pixelArt from '@dicebear/pixel-art'

type AvatarUser = {
  id: string
  avatarUrl?: string | null
}

const DEFAULT_BACKGROUND = ['f1f5f9']

export const AVATAR_LIBRARY_STYLES = [
  { id: 'notionists', labelKey: 'settings.avatarStyle.notionists' },
  { id: 'pixel-art', labelKey: 'settings.avatarStyle.pixelArt' },
  { id: 'lorelei', labelKey: 'settings.avatarStyle.lorelei' },
] as const

export type AvatarLibraryStyle = (typeof AVATAR_LIBRARY_STYLES)[number]['id']

/**
 * Creates a stable, local SVG avatar. No network request is made: the same seed
 * always results in the same image, so users without a custom image remain
 * recognizable everywhere in the product.
 */
export function getGeneratedAvatarUrl(
  seed: string,
  style: AvatarLibraryStyle = 'notionists',
): string {
  const options = {
    seed,
    backgroundColor: ['dbeafe', 'dcfce7', 'fce7f3', 'fef3c7', 'ede9fe', 'cffafe'],
    radius: 50,
  }

  if (style === 'pixel-art') return createAvatar(pixelArt, options).toDataUri()
  if (style === 'lorelei') {
    return createAvatar(lorelei, {
      ...options,
      backgroundColor: DEFAULT_BACKGROUND,
    }).toDataUri()
  }
  return createAvatar(notionists, options).toDataUri()
}

export function getUserAvatarUrl(user: AvatarUser): string {
  return user.avatarUrl?.trim() || getGeneratedAvatarUrl(user.id)
}
