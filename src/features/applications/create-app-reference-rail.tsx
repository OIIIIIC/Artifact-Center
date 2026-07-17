import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const railSurface = cn(
  'rounded-2xl bg-muted/25 ring-1 ring-border/60',
  'dark:bg-muted/15 dark:ring-border/80',
)

/**
 * Right-rail (lg+) / below-form companion for create page.
 * Naming & package reference only — not a help doc or second form.
 */
export function CreateAppReferenceRail({
  apps,
  conflictId,
  className,
}: {
  apps: Application[]
  /** Package exact collision — highlight that row */
  conflictId?: string | null
  className?: string
}) {
  const { t } = useTranslation()
  const hasQueryResults = apps.length > 0

  return (
    <aside
      className={cn(railSurface, 'flex flex-col', className)}
      aria-label={t('createApp.referenceTitle')}
    >
      <div className="border-b border-border/50 px-4 py-3.5 sm:px-5">
        <h2 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
          {t('createApp.referenceTitle')}
        </h2>
        <p className="mt-0.5 text-[0.75rem] leading-relaxed text-muted-foreground">
          {hasQueryResults
            ? t('createApp.referenceHintActive')
            : t('createApp.referenceHintIdle')}
        </p>
      </div>

      <div className="min-h-0 flex-1 px-2 py-2 sm:px-2.5 sm:py-2.5">
        {!hasQueryResults ? (
          <p className="px-2.5 py-8 text-center text-[0.8125rem] leading-relaxed text-muted-foreground/80">
            {t('createApp.referenceEmpty')}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {apps.map((app) => {
              const Icon = PLATFORM_ICON[app.platform]
              const isConflict = conflictId != null && app.id === conflictId
              return (
                <li key={app.id}>
                  <Link
                    to={`/applications/${app.id}`}
                    className={cn(
                      'flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2',
                      'transition-colors duration-[var(--duration-hover)]',
                      'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      isConflict && 'bg-muted/45 ring-1 ring-border/70 dark:bg-muted/30',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        'bg-muted/70 text-[10px] font-semibold tracking-tight text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {initialsOf(app.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[0.8125rem] font-medium text-foreground">
                          {app.name}
                        </span>
                        {isConflict ? (
                          <span className="shrink-0 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
                            {t('createApp.referenceConflictBadge')}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="mt-0.5 block truncate font-mono text-[0.6875rem] text-muted-foreground"
                        title={app.packageName}
                      >
                        {app.packageName}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] text-muted-foreground">
                      <Icon className="size-3 opacity-70" strokeWidth={1.75} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
