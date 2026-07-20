import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { APPLICATION_STATUS_LABEL, StatusBadge } from '@/components/common/status-badge'
import {
  PLATFORM_ICON,
  PLATFORM_LABEL,
  PLATFORM_TONE,
} from '@/features/applications/platform-meta'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Application, ApplicationStatus } from '@/types/application'

interface ApplicationCardProps {
  application: Application
  className?: string
}

function statusKey(status: ApplicationStatus): string | null {
  if (status === 'active') return null
  /** Same keys as detail / settings — one lifecycle vocabulary */
  return `appSettings.status.${status}`
}

export function ApplicationCard({ application, className }: ApplicationCardProps) {
  const { t, i18n } = useTranslation()
  const PlatformIcon = PLATFORM_ICON[application.platform]
  const initials = application.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const sKey = statusKey(application.status)
  const statusVariant =
    application.status === 'new'
      ? 'new'
      : application.status === 'beta'
        ? 'beta'
        : application.status === 'deprecated'
          ? 'deprecated'
          : application.status === 'archived'
            ? 'archived'
            : application.status === 'active'
              ? 'success'
              : 'default'

  // force re-format when locale changes
  void i18n.language

  return (
    <Link
      to={`/applications/${application.id}`}
      className={cn(
        'group/card relative flex h-full flex-col rounded-2xl bg-card/80 p-5',
        'ring-1 ring-border/70',
        'transition-[border-color,background-color,transform,box-shadow,ring-color] duration-[var(--duration-page)] ease-standard',
        'hover:-translate-y-0.5 hover:bg-card hover:ring-border-strong/80',
        'dark:bg-card/60 dark:ring-border dark:hover:bg-card dark:hover:ring-border-strong',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-[14px]',
            'text-[0.8125rem] font-semibold tracking-tight',
            PLATFORM_TONE[application.platform],
          )}
          aria-hidden
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3
              className="line-clamp-2 min-w-0 break-words text-[0.9375rem] leading-snug font-semibold tracking-tight text-foreground"
              title={application.name}
            >
              {application.name}
            </h3>
            {sKey ? (
              <StatusBadge
                status={statusVariant}
                className={cn(
                  'shrink-0',
                  application.status === 'new'
                    ? 'uppercase'
                    : 'normal-case tracking-normal',
                )}
              >
                {t(sKey)}
              </StatusBadge>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 text-[0.8125rem] leading-relaxed font-normal text-muted-foreground">
            {application.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-5 items-center rounded-md bg-muted/55 px-1.5 text-[11px] font-medium text-foreground/75 dark:bg-muted/45">
          {application.region.name}
        </span>
        <span className="inline-flex h-5 items-center gap-1 rounded-md bg-muted/50 px-1.5 text-[11px] text-muted-foreground dark:bg-muted/40">
          <PlatformIcon className="size-3 opacity-70" strokeWidth={1.75} aria-hidden />
          {t(`platform.${application.platform}`)}
        </span>
        {application.latestVersion.trim() ? (
          <span className="inline-flex h-5 items-center rounded-md bg-muted/40 px-1.5 font-mono text-[11px] text-muted-foreground dark:bg-muted/30">
            v{application.latestVersion}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <time
          className="text-[0.75rem] text-muted-foreground/70"
          dateTime={application.updatedAt}
          title={application.updatedAt}
        >
          {formatRelativeTime(application.updatedAt)}
        </time>
        <span className="shrink-0 text-[0.75rem] text-muted-foreground/70">
          {t('applications.artifactsCount', { count: application.artifactCount })}
        </span>
      </div>
    </Link>
  )
}

// re-export for any leftover imports
export { APPLICATION_STATUS_LABEL, PLATFORM_LABEL }
