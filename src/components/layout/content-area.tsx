import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ContentAreaProps {
  children: ReactNode
  className?: string
}

/**
 * Scrollable main region inside AppLayout (below Topbar).
 * Owns overflow; PageContainer lives inside for width/padding.
 */
export function ContentArea({ children, className }: ContentAreaProps) {
  return (
    <div
      data-slot="content-area"
      className={cn(
        'min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden',
        className,
      )}
    >
      {children}
    </div>
  )
}
