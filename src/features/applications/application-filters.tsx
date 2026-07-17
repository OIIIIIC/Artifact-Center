import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type {
  ApplicationFilters,
  ApplicationPlatform,
  ApplicationSort,
} from '@/types/application'

const PLATFORMS: (ApplicationPlatform | 'all')[] = ['all', 'android', 'windows', 'zip']

const SORTS: ApplicationSort[] = ['updated', 'name', 'created']

interface ApplicationFiltersBarProps {
  filters: ApplicationFilters
  onChange: (next: ApplicationFilters) => void
  meta?: ReactNode
  trailing?: ReactNode
  className?: string
}

function Segmented({
  'aria-label': ariaLabel,
  children,
}: {
  'aria-label': string
  children: ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap rounded-lg bg-muted/40 p-0.5 dark:bg-muted/25"
    >
      {children}
    </div>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-[0.8125rem] font-medium',
        'transition-[color,background-color,box-shadow] duration-[var(--duration-hover)] ease-standard',
        active
          ? 'bg-background text-foreground shadow-[var(--shadow-xs)] dark:bg-card dark:shadow-none dark:ring-1 dark:ring-border/80'
          : 'text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

export function ApplicationFiltersBar({
  filters,
  onChange,
  meta,
  trailing,
  className,
}: ApplicationFiltersBarProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Segmented aria-label={t('platform.all')}>
          {PLATFORMS.map((p) => (
            <SegmentButton
              key={p}
              active={filters.platform === p}
              onClick={() => onChange({ ...filters, platform: p })}
            >
              {p === 'all' ? t('platform.all') : t(`platform.${p}`)}
            </SegmentButton>
          ))}
        </Segmented>
        {meta ? (
          <span className="text-[0.75rem] text-muted-foreground/75">{meta}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
        <Segmented aria-label={t('sort.label')}>
          {SORTS.map((s) => (
            <SegmentButton
              key={s}
              active={filters.sort === s}
              onClick={() => onChange({ ...filters, sort: s })}
            >
              {t(`sort.${s}`)}
            </SegmentButton>
          ))}
        </Segmented>
        {trailing}
      </div>
    </div>
  )
}
