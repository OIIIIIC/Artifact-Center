import { Download, Eye } from 'lucide-react'

import { ArtifactStatusBadge } from '@/features/applications/artifact-status-badge'
import { PLATFORM_ICON, PLATFORM_LABEL } from '@/features/applications/platform-meta'
import { formatFileSize, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Artifact } from '@/types/artifact'

interface OverviewRecentVersionsProps {
  artifacts: Artifact[]
  className?: string
}

/**
 * Overview: last three builds — scan then act (View / Download quiet).
 */
export function OverviewRecentVersions({
  artifacts,
  className,
}: OverviewRecentVersionsProps) {
  if (artifacts.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        还没有版本记录。上传第一个 Artifact 后会出现在这里。
      </p>
    )
  }

  return (
    <ul className={cn('space-y-3', className)}>
      {artifacts.map((art) => {
        const PlatformIcon = PLATFORM_ICON[art.platform]
        return (
          <li
            key={art.id}
            className={cn(
              'group/row flex flex-col gap-3 rounded-xl bg-card/60 p-4 ring-1 ring-border/60',
              'transition-[background-color,ring-color] duration-[var(--duration-hover)]',
              'hover:bg-card hover:ring-border',
              'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
              'dark:bg-card/40 dark:hover:bg-card/70',
            )}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.9375rem] font-medium text-foreground">
                  v{art.version}
                </span>
                <ArtifactStatusBadge status={art.status} />
                <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
                  <PlatformIcon className="size-3 opacity-70" strokeWidth={1.75} />
                  {PLATFORM_LABEL[art.platform]}
                </span>
              </div>
              <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {art.releaseNotes}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-muted-foreground/80">
                <span>Build {art.buildNumber}</span>
                <span aria-hidden>·</span>
                <time dateTime={art.uploadedAt}>
                  {formatRelativeTime(art.uploadedAt)}
                </time>
                <span aria-hidden>·</span>
                <span>{art.uploader}</span>
                <span aria-hidden>·</span>
                <span>{formatFileSize(art.sizeBytes)}</span>
              </div>
            </div>

            <div className="relative z-10 flex shrink-0 items-center gap-1">
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[0.8125rem] font-medium',
                  'text-muted-foreground transition-colors duration-[var(--duration-hover)]',
                  'hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Eye className="size-3.5 opacity-70" strokeWidth={1.75} />
                View
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[0.8125rem] font-medium',
                  'text-muted-foreground transition-colors duration-[var(--duration-hover)]',
                  'hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Download className="size-3.5 opacity-70" strokeWidth={1.75} />
                Download
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
