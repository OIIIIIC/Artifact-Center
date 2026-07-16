import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type {
  ApplicationFilters,
  ApplicationPlatform,
  ApplicationSort,
} from '@/types/application'

import { PLATFORM_LABEL } from './platform-meta'

const platforms: { value: ApplicationPlatform | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'android', label: PLATFORM_LABEL.android },
  { value: 'windows', label: PLATFORM_LABEL.windows },
  { value: 'zip', label: PLATFORM_LABEL.zip },
]

const sorts: { value: ApplicationSort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'name', label: 'Name' },
  { value: 'created', label: 'Date created' },
]

interface ApplicationFiltersBarProps {
  filters: ApplicationFilters
  onChange: (next: ApplicationFilters) => void
  /** e.g. result count — lives in the filter row, not floating */
  meta?: ReactNode
  trailing?: ReactNode
  className?: string
}

export function ApplicationFiltersBar({
  filters,
  onChange,
  meta,
  trailing,
  className,
}: ApplicationFiltersBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Filter by platform"
          className="inline-flex max-w-full flex-wrap rounded-lg bg-muted/40 p-0.5 dark:bg-muted/25"
        >
          {platforms.map((p) => {
            const active = filters.platform === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange({ ...filters, platform: p.value })}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[0.8125rem] font-medium',
                  'transition-[color,background-color,box-shadow] duration-[var(--duration-hover)] ease-standard',
                  active
                    ? 'bg-background text-foreground shadow-[var(--shadow-xs)] dark:bg-card dark:shadow-none dark:ring-1 dark:ring-border/80'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={active}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        {meta ? (
          <span className="text-[0.75rem] text-muted-foreground/75">{meta}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
        <label className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground/80">
          <span className="sr-only">Sort</span>
          <select
            value={filters.sort}
            onChange={(e) =>
              onChange({ ...filters, sort: e.target.value as ApplicationSort })
            }
            className={cn(
              'h-8 cursor-pointer appearance-none bg-transparent pr-1',
              'text-[0.75rem] text-muted-foreground outline-none',
              'transition-colors duration-[var(--duration-hover)] hover:text-foreground',
            )}
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {trailing}
      </div>
    </div>
  )
}
