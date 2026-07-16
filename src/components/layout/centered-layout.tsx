import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface CenteredLayoutProps {
  children: ReactNode
  className?: string
  /** Max width of the centered column */
  maxWidthClassName?: string
}

/**
 * Viewport-centered column for empty states and future focused flows.
 */
export function CenteredLayout({
  children,
  className,
  maxWidthClassName = 'max-w-md',
}: CenteredLayoutProps) {
  return (
    <div
      data-slot="centered-layout"
      className={cn(
        'flex min-h-dvh items-center justify-center bg-background px-[var(--page-padding-x)] py-12',
        className,
      )}
    >
      <div className={cn('w-full', maxWidthClassName)}>{children}</div>
    </div>
  )
}
