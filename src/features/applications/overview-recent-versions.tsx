import { Download, Eye, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ArtifactReleaseBadges } from '@/features/applications/artifact-release-badges'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useDownloadArtifact } from '@/features/applications/use-download-artifact'
import { formatFileSize, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Artifact } from '@/types/artifact'

interface OverviewRecentVersionsProps {
  artifacts: Artifact[]
  className?: string
}

export function OverviewRecentVersions({
  artifacts,
  className,
}: OverviewRecentVersionsProps) {
  const { t, i18n } = useTranslation()
  void i18n.language
  const { download, isBusy } = useDownloadArtifact()

  if (artifacts.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">{t('detail.noVersions')}</p>
    )
  }

  return (
    <ul className={cn('space-y-3', className)}>
      {artifacts.map((art) => {
        const PlatformIcon = PLATFORM_ICON[art.platform]
        const busy = isBusy(art.id)
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
                <ArtifactReleaseBadges artifact={art} />
                <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
                  <PlatformIcon className="size-3 opacity-70" strokeWidth={1.75} />
                  {t(`platform.${art.platform}`)}
                </span>
              </div>
              <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {art.releaseNotes}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-muted-foreground/80">
                <span>{t('detail.build', { number: art.buildNumber })}</span>
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
                {t('common.view')}
              </button>
              <button
                type="button"
                disabled={busy}
                className={cn(
                  'inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[0.8125rem] font-medium',
                  'text-muted-foreground transition-colors duration-[var(--duration-hover)]',
                  'hover:bg-muted/60 hover:text-foreground',
                  'disabled:pointer-events-none disabled:opacity-50',
                )}
                onClick={() =>
                  void download({
                    id: art.id,
                    filename: art.filename,
                    version: art.version,
                    sizeBytes: art.sizeBytes,
                  })
                }
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Download className="size-3.5 opacity-70" strokeWidth={1.75} />
                )}
                {t('common.download')}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
