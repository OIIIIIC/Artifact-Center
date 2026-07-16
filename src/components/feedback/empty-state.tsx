import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border',
        'bg-transparent px-8 py-20 text-center',
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            'mb-5 flex size-12 items-center justify-center rounded-2xl',
            'border border-border bg-surface-muted/60 text-muted-foreground',
            'dark:bg-surface-muted/40',
          )}
        >
          <Icon className="size-5" strokeWidth={1.5} aria-hidden />
        </div>
      ) : null}
      <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-xs text-[0.8125rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  )
}
