import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: ReactNode
  className?: string
  /** Constrain to design-system content width (default true) */
  constrained?: boolean
}

export function PageContainer({
  children,
  className,
  constrained = true,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'w-full px-[var(--page-padding-x)] py-[var(--page-padding-y)]',
        constrained && 'mx-auto max-w-[var(--content-max-width)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
