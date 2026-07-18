import { Download, Loader2, Package, Share2, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { ShareDialog } from '@/features/share/share-dialog'
import { ArtifactReleaseBadges } from '@/features/applications/artifact-release-badges'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useDownloadArtifact } from '@/features/applications/use-download-artifact'
import { formatFileSize, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApplicationStatus } from '@/types/application'
import { getArtifactRiskStatus, type Artifact } from '@/types/artifact'

interface OverviewRecentVersionsProps {
  artifacts: Artifact[]
  applicationId?: string
  applicationName?: string
  applicationStatus?: ApplicationStatus
  className?: string
}

/**
 * Application Detail → Overview: recent builds for quick confirm + download.
 * Card list (not table). Download is secondary; upload stays on the page header.
 */
export function OverviewRecentVersions({
  artifacts,
  applicationId,
  applicationName,
  applicationStatus,
  className,
}: OverviewRecentVersionsProps) {
  const { t, i18n } = useTranslation()
  void i18n.language
  const { download, isBusy, downloadConfirmation } = useDownloadArtifact()
  const [shareArt, setShareArt] = useState<Artifact | null>(null)
  const applicationArchived = applicationStatus === 'archived'

  if (artifacts.length === 0) {
    const uploadTo = applicationId ? `/upload?app=${applicationId}` : '/upload'
    return (
      <EmptyState
        icon={Package}
        title={t('detail.noVersionsTitle')}
        description={t('detail.noVersions')}
        className={cn('py-12', className)}
        action={
          applicationArchived ? undefined : (
            <Button asChild size="lg">
              <Link to={uploadTo}>
                <Upload className="size-3.5" strokeWidth={1.75} />
                {t('detail.uploadArtifact')}
              </Link>
            </Button>
          )
        }
      />
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <ul className="space-y-3">
        {artifacts.map((art, index) => {
          const PlatformIcon = PLATFORM_ICON[art.platform]
          const busy = isBusy(art.id)
          const notes = art.releaseNotes?.trim()
          const isLead = index === 0

          return (
            <li
              key={art.id}
              className={cn(
                'group/row flex flex-col gap-3 rounded-xl p-4 ring-1',
                'transition-[background-color,ring-color] duration-[var(--duration-hover)]',
                'sm:flex-row sm:items-start sm:justify-between sm:gap-6',
                isLead
                  ? cn(
                      'bg-card/80 ring-border/70',
                      'hover:bg-card hover:ring-border',
                      'dark:bg-card/55 dark:hover:bg-card/75',
                    )
                  : cn(
                      'bg-card/60 ring-border/60',
                      'hover:bg-card hover:ring-border',
                      'dark:bg-card/40 dark:hover:bg-card/70',
                    ),
              )}
            >
              <div className="min-w-0 flex-1 space-y-2">
                {/* L1: version · release badges · platform */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'font-mono tracking-tight text-foreground',
                      isLead
                        ? 'text-[1rem] font-semibold'
                        : 'text-[0.9375rem] font-medium',
                    )}
                  >
                    v{art.version}
                  </span>
                  <ArtifactReleaseBadges artifact={art} size={isLead ? 'md' : 'sm'} />
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/45 px-1.5 py-0.5 text-[0.75rem] text-muted-foreground dark:bg-muted/30">
                    <PlatformIcon className="size-3 opacity-70" strokeWidth={1.75} />
                    {t(`platform.${art.platform}`)}
                  </span>
                </div>

                {/* L2: release notes — omit when empty */}
                {notes ? (
                  <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {notes}
                  </p>
                ) : null}

                {/* L3: build · time · uploader · size */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-muted-foreground/75">
                  <span>{t('detail.build', { number: art.buildNumber })}</span>
                  <span className="text-muted-foreground/35" aria-hidden>
                    ·
                  </span>
                  <time dateTime={art.uploadedAt}>
                    {formatRelativeTime(art.uploadedAt)}
                  </time>
                  <span className="text-muted-foreground/35" aria-hidden>
                    ·
                  </span>
                  <span>{art.uploader}</span>
                  <span className="text-muted-foreground/35" aria-hidden>
                    ·
                  </span>
                  <span>{formatFileSize(art.sizeBytes)}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 sm:pt-0.5">
                {applicationId && applicationName ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`${t('share.action')} v${art.version}`}
                    onClick={() => setShareArt(art)}
                  >
                    <Share2 className="size-3.5 opacity-70" strokeWidth={1.75} />
                    {t('share.action')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`${t('common.download')} v${art.version}`}
                  onClick={() =>
                    void download({
                      id: art.id,
                      artifactId: art.id,
                      filename: art.filename,
                      version: art.version,
                      sizeBytes: art.sizeBytes,
                      riskStatus: applicationArchived
                        ? 'applicationArchived'
                        : getArtifactRiskStatus(art),
                    })
                  }
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Download className="size-3.5 opacity-70" strokeWidth={1.75} />
                  )}
                  {t('common.download')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {applicationId && applicationName && shareArt ? (
        <ShareDialog
          open
          onOpenChange={(open) => {
            if (!open) setShareArt(null)
          }}
          applicationId={applicationId}
          applicationName={applicationName}
          artifact={shareArt}
          applicationArchived={applicationArchived}
        />
      ) : null}
      {downloadConfirmation}
    </div>
  )
}
