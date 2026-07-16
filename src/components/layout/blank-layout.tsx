import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface BlankLayoutProps {
  children: ReactNode
  className?: string
}

/**
 * Zero chrome shell — future auth / full-screen wizards.
 * No sidebar, no topbar. Still uses design background tokens.
 */
export function BlankLayout({ children, className }: BlankLayoutProps) {
  return (
    <div
      data-slot="blank-layout"
      className={cn('min-h-dvh bg-background text-foreground', className)}
    >
      {children}
    </div>
  )
}
