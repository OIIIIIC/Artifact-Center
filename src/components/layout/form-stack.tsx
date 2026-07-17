import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface FormStackProps {
  children: ReactNode
  className?: string
  /**
   * Cap width for form readability. Always left-aligned inside the product shell.
   * Default uses `--form-max-width` so create / settings / app settings match.
   */
  constrained?: boolean
}

/**
 * Form / settings field stack inside a full-width product page.
 * Never centers the shell — only limits field line length.
 */
export function FormStack({ children, className, constrained = true }: FormStackProps) {
  return (
    <div
      data-slot="form-stack"
      className={cn('w-full', constrained && 'max-w-[var(--form-max-width)]', className)}
    >
      {children}
    </div>
  )
}
