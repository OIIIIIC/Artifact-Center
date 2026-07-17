import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /**
   * `product` matches Applications / Settings index pages.
   * `compact` for nested sections (e.g. detail sub-panels).
   */
  size?: 'product' | 'compact'
}

/**
 * Page-level header: Title + Description + optional Action cluster.
 * Same type scale and spacing across product pages — do not reinvent H1 per route.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
  size = 'product',
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      data-size={size}
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h1
          className={cn(
            'font-semibold tracking-tight text-foreground',
            size === 'product' &&
              'text-[1.875rem] leading-tight sm:text-[2rem] md:text-[2.125rem]',
            size === 'compact' && 'text-[1.5rem] leading-tight sm:text-[1.75rem]',
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              'max-w-2xl leading-relaxed',
              size === 'product' && 'text-[0.875rem] text-muted-foreground/85',
              size === 'compact' && 'text-[0.875rem] text-muted-foreground',
            )}
          >
            {description}
          </p>
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
