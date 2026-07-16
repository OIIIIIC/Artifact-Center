import { Download, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

import { APPLICATION_STATUS_LABEL, StatusBadge } from '@/components/common/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PLATFORM_ICON, PLATFORM_LABEL } from '@/features/applications/platform-meta'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'

const iconTone: Record<Application['platform'], string> = {
  android:
    'bg-emerald-500/[0.07] text-emerald-900/80 dark:bg-emerald-400/10 dark:text-emerald-200/80',
  windows: 'bg-sky-500/[0.07] text-sky-950/80 dark:bg-sky-400/10 dark:text-sky-200/80',
  zip: 'bg-stone-500/[0.08] text-stone-800/80 dark:bg-stone-400/10 dark:text-stone-200/80',
}

interface ApplicationDetailHeaderProps {
  application: Application
  className?: string
}

/**
 * Object-first header: identity + quiet actions (no edit/delete).
 */
export function ApplicationDetailHeader({
  application,
  className,
}: ApplicationDetailHeaderProps) {
  const PlatformIcon = PLATFORM_ICON[application.platform]
  const initials = application.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const ownerInitial = application.owner
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const statusLabel = APPLICATION_STATUS_LABEL[application.status]

  return (
    <header
      className={cn(
        'flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-4 sm:gap-5">
        <div
          className={cn(
            'flex size-16 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold tracking-tight sm:size-[4.5rem] sm:text-xl',
            iconTone[application.platform],
          )}
          aria-hidden
        >
          {initials}
        </div>

        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.5rem] leading-tight font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              {application.name}
            </h1>
            {statusLabel ? (
              <StatusBadge
                status={
                  application.status === 'new'
                    ? 'new'
                    : application.status === 'beta'
                      ? 'beta'
                      : application.status === 'deprecated'
                        ? 'deprecated'
                        : 'archived'
                }
              >
                {statusLabel}
              </StatusBadge>
            ) : null}
          </div>

          <p className="max-w-2xl text-[0.875rem] leading-relaxed text-muted-foreground">
            {application.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/45 px-2 py-0.5 text-muted-foreground dark:bg-muted/30">
              <PlatformIcon className="size-3.5 opacity-70" strokeWidth={1.75} />
              {PLATFORM_LABEL[application.platform]}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Avatar size="sm" className="size-5">
                <AvatarFallback className="text-[9px]">{ownerInitial}</AvatarFallback>
              </Avatar>
              {application.owner}
            </span>
            <span className="text-muted-foreground/40" aria-hidden>
              ·
            </span>
            <time dateTime={application.updatedAt}>
              Updated {formatRelativeTime(application.updatedAt)}
            </time>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-1.5 rounded-lg border-0 bg-muted/40 text-muted-foreground ring-1 ring-border/60',
            'hover:bg-muted/55 hover:text-foreground',
          )}
        >
          <Download className="size-3.5" strokeWidth={1.75} />
          Download Latest
        </Button>
        <Button type="button" size="sm" className="h-9 gap-1.5 rounded-lg">
          <Upload className="size-3.5" strokeWidth={1.75} />
          Upload Artifact
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground lg:hidden"
        >
          <Link to="/">Back</Link>
        </Button>
      </div>
    </header>
  )
}
