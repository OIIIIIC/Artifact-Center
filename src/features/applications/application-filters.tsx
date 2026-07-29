import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
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

const easeOut = [0.2, 0, 0, 1] as const

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
  layoutId,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  /** Shared layout id so the active pill slides between options */
  layoutId: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-md px-3 py-1.5 text-[0.8125rem] font-medium',
        'transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
        active
          ? 'text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {active ? (
        <motion.span
          layoutId={reduceMotion ? undefined : layoutId}
          className={cn(
            'absolute inset-0 rounded-md bg-primary shadow-[var(--shadow-xs)]',
            'ring-1 ring-primary/20',
          )}
          transition={{ duration: 0.22, ease: easeOut }}
          aria-hidden
        />
      ) : null}
      <span className="relative z-[1]">{children}</span>
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
        <LayoutGroup id="application-platform-filter">
          <Segmented aria-label={t('filters.platform')}>
            {PLATFORMS.map((p) => (
              <SegmentButton
                key={p}
                layoutId="platform-filter-pill"
                active={filters.platform === p}
                onClick={() => onChange({ ...filters, platform: p })}
              >
                {p === 'all' ? t('platform.all') : t(`platform.${p}`)}
              </SegmentButton>
            ))}
          </Segmented>
        </LayoutGroup>
        {meta ? (
          <span className="text-[0.75rem] text-muted-foreground/75">{meta}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
        <LayoutGroup id="application-sort-filter">
          <Segmented aria-label={t('sort.label')}>
            {SORTS.map((s) => (
              <SegmentButton
                key={s}
                layoutId="sort-filter-pill"
                active={filters.sort === s}
                onClick={() => onChange({ ...filters, sort: s })}
              >
                {t(`sort.${s}`)}
              </SegmentButton>
            ))}
          </Segmented>
        </LayoutGroup>
        {trailing}
      </div>
    </div>
  )
}
