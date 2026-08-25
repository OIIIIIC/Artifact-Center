import * as React from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getUserAvatarUrl } from './user-avatar-url'

type AvatarUser = {
  id: string
  name: string
  avatarUrl?: string | null
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U'
  )
}

type UserAvatarProps = Omit<React.ComponentProps<typeof Avatar>, 'children'> & {
  user: AvatarUser
  fallbackClassName?: string
}

/** A user avatar that prefers a selected/uploaded image and falls back to DiceBear. */
export function UserAvatar({ user, fallbackClassName, ...props }: UserAvatarProps) {
  return (
    <Avatar {...props}>
      <AvatarImage src={getUserAvatarUrl(user)} alt="" />
      <AvatarFallback className={fallbackClassName}>{initials(user.name)}</AvatarFallback>
    </Avatar>
  )
}
