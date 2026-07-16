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

export function Section({
  children,
  className,
  title,
  description,
  action,
  id,
}: SectionProps) {
  return (
    <section id={id} className={cn('space-y-4', className)}>
      {title || description || action ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1 min-w-0">
            {title ? <h2 className="text-h2 text-foreground">{title}</h2> : null}
            {description ? (
              <p className="text-caption text-muted-foreground max-w-2xl">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
