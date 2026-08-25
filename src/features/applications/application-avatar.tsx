import { createElement } from 'react'

import {
  resolveApplicationIcon,
  resolveApplicationIconTone,
} from '@/features/applications/application-avatar-meta'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'

export function ApplicationAvatar({
  application,
  className,
  iconClassName,
}: {
  application: Pick<Application, 'platform' | 'iconKey' | 'iconColor'>
  className?: string
  iconClassName?: string
}) {
  const icon = createElement(resolveApplicationIcon(application), {
    className: cn('size-5', iconClassName),
    strokeWidth: 1.75,
  })
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl',
        resolveApplicationIconTone(application),
        className,
      )}
      aria-hidden
    >
      {icon}
    </span>
  )
}
