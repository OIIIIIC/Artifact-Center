import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SectionProps {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  action?: ReactNode
  id?: string
}

/**
 * Standard vertical block: Title / Description / Content.
 * Use for every major page region instead of one-off heading stacks.
 */
export function Section({
  children,
  className,
  title,
  description,
  action,
  id,
}: SectionProps) {
  return (
    <section id={id} data-slot="section" className={cn('space-y-4', className)}>
      {title || description || action ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {title ? <h2 className="text-h2 text-foreground">{title}</h2> : null}
            {description ? (
              <p className="text-caption max-w-2xl text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div data-slot="section-content">{children}</div>
    </section>
  )
}
