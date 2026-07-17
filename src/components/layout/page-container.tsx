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
  /**
   * Vertical rhythm for product pages (list / detail / settings / search).
   * Prefer this over ad-hoc pt/pb so pages share the same top/bottom band.
   */
  rhythm?: 'default' | 'product'
}

/**
 * Unified page content frame: max-width + horizontal/vertical padding tokens.
 * Future pages must wrap primary content with this — not ad-hoc margins.
 *
 * Width rule: shell is always `--content-max-width`. Narrow forms with
 * `max-w-[var(--form-max-width)]` on the form stack only, left-aligned.
 */
export function PageContainer({
  children,
  className,
  constrained = true,
  noPaddingY = false,
  noPaddingX = false,
  rhythm = 'default',
}: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      data-rhythm={rhythm}
      className={cn(
        'w-full',
        !noPaddingX && 'px-[var(--page-padding-x)]',
        !noPaddingY && rhythm === 'product' && 'pb-24 pt-9 sm:pt-11 md:pt-12',
        !noPaddingY && rhythm === 'default' && 'py-[var(--page-padding-y)]',
        constrained && 'mx-auto max-w-[var(--content-max-width)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
