import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/**
 * Page-level header only: Title + Description + single Action cluster.
 * No breadcrumbs, no filters, no multi-row toolbars — keep it simple.
 */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-h1 text-foreground tracking-tight">{title}</h1>
        {description ? (
          <p className="text-body max-w-2xl text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
          {action}
        </div>
      ) : null}
    </header>
  )
}
