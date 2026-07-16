import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: ReactNode
  className?: string
  /**
   * Constrain to design content max-width (default true).
   * All product pages must use PageContainer for horizontal rhythm.
   */
  constrained?: boolean
  /** Remove vertical padding when nested under another padded region */
  noPaddingY?: boolean
  noPaddingX?: boolean
}

/**
 * Unified page content frame: max-width + horizontal/vertical padding tokens.
 * Future pages must wrap primary content with this — not ad-hoc margins.
 */
export function PageContainer({
  children,
  className,
  constrained = true,
  noPaddingY = false,
  noPaddingX = false,
}: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        'w-full',
        !noPaddingX && 'px-[var(--page-padding-x)]',
        !noPaddingY && 'py-[var(--page-padding-y)]',
        constrained && 'mx-auto max-w-[var(--content-max-width)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
