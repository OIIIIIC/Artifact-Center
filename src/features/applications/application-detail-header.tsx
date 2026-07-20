import { Download, Loader2, MapPin, Share2, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { StatusBadge } from '@/components/common/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArtifactReleaseBadges } from '@/features/applications/artifact-release-badges'
import { PLATFORM_ICON, PLATFORM_TONE } from '@/features/applications/platform-meta'
import { useDownloadArtifact } from '@/features/applications/use-download-artifact'
import { ShareDialog } from '@/features/share/share-dialog'
import { formatFileSize, formatRelativeTime } from '@/lib/format'
import { canWriteContent } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Application } from '@/types/application'
import {
  getArtifactChannel,
  getArtifactRiskStatus,
  type Artifact,
} from '@/types/artifact'

interface ApplicationDetailHeaderProps {
  application: Application
  /** Prefer latest artifact for real filename/size when available */
  latest?: Artifact
  className?: string
}

function extFor(platform: Application['platform']) {
  if (platform === 'windows') return 'exe'
  if (platform === 'zip') return 'zip'
  return 'apk'
}

export function ApplicationDetailHeader({
  application,
  latest,
  className,
}: ApplicationDetailHeaderProps) {
  const { t, i18n } = useTranslation()
  void i18n.language
  const role = useAuthStore((s) => s.user?.role)
  const canWrite = canWriteContent(role)
  const applicationArchived = application.status === 'archived'
  const { download, isBusy, downloadConfirmation } = useDownloadArtifact()
  const [shareOpen, setShareOpen] = useState(false)
  const latestKey = `latest:${application.id}`
  const downloading = isBusy(latestKey)

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

  /**
   * App lifecycle (新建/Beta/弃用) vs artifact release (最新+渠道) are different domains.
   * Title row = name + version badges only; app status lives in the meta row.
   */
  const appStatusBadge =
    application.status === 'active'
      ? null
      : {
          label: t(`appSettings.status.${application.status}`),
          status:
            application.status === 'new'
              ? ('new' as const)
              : application.status === 'beta'
                ? ('beta' as const)
                : application.status === 'deprecated'
                  ? ('deprecated' as const)
                  : application.status === 'archived'
                    ? ('archived' as const)
                    : ('success' as const),
        }

  const latestVersion = latest?.version ?? application.latestVersion
  const hasVersion = Boolean(latestVersion?.trim())
  const downloadLabel = hasVersion
    ? t('detail.downloadLatestVersion', { version: latestVersion })
    : t('detail.downloadLatest')
  const downloadTooltip = hasVersion
    ? [
        t('detail.downloadLatestHint', {
          build: latest?.buildNumber ?? '—',
        }),
        latest ? t(`channel.${getArtifactChannel(latest)}`) : null,
        latest?.filename,
        latest?.sizeBytes != null ? formatFileSize(latest.sizeBytes) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : t('detail.noLatestYet')

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
            PLATFORM_TONE[application.platform],
          )}
          aria-hidden
        >
          {initials}
        </div>

        <div className="min-w-0 space-y-2.5">
          {/* Title: app name + artifact version / latest / channel only */}
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="line-clamp-2 min-w-0 break-words text-[1.5rem] leading-tight font-semibold tracking-tight text-foreground sm:text-[1.75rem]"
              title={application.name}
            >
              {application.name}
            </h1>
            {hasVersion ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5',
                    'bg-muted/50 font-mono text-[0.75rem] font-semibold tracking-tight text-foreground',
                    'dark:bg-muted/35',
                  )}
                  title={
                    latest?.buildNumber
                      ? t('detail.latestBuild', { number: latest.buildNumber })
                      : undefined
                  }
                >
                  v{latestVersion}
                </span>
                {latest ? (
                  <ArtifactReleaseBadges artifact={latest} size="md" />
                ) : (
                  <StatusBadge status="new" className="uppercase tracking-wider">
                    {t('status.latest')}
                  </StatusBadge>
                )}
              </span>
            ) : null}
          </div>

          <p
            className="line-clamp-3 max-w-2xl break-words text-[0.875rem] leading-relaxed text-muted-foreground"
            title={application.description}
          >
            {application.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-muted-foreground">
            {appStatusBadge ? (
              <StatusBadge
                status={appStatusBadge.status}
                className="normal-case tracking-normal"
              >
                {appStatusBadge.label}
              </StatusBadge>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/45 px-2 py-0.5 text-muted-foreground dark:bg-muted/30">
              <MapPin className="size-3.5 opacity-70" strokeWidth={1.75} />
              {application.region.name}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/45 px-2 py-0.5 text-muted-foreground dark:bg-muted/30">
              <PlatformIcon className="size-3.5 opacity-70" strokeWidth={1.75} />
              {t(`platform.${application.platform}`)}
            </span>
            {latest?.filename ? (
              <span
                className="max-w-[14rem] truncate font-mono text-[0.75rem] text-muted-foreground/85"
                title={latest.filename}
              >
                {latest.filename}
              </span>
            ) : null}
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
              {t('detail.updated', {
                time: formatRelativeTime(application.updatedAt),
              })}
            </time>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end lg:pt-1">
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Download only when a version exists — avoids a dead primary-looking control */}
          {hasVersion ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={downloading}
                  className={cn(
                    'border-0 bg-muted/40 text-foreground ring-1 ring-border/60',
                    'hover:bg-muted/55',
                    'disabled:opacity-50',
                  )}
                  onClick={() => {
                    const filename =
                      latest?.filename ??
                      `${application.packageName.split('.').pop() ?? 'app'}-${latestVersion}.${extFor(application.platform)}`
                    void download({
                      id: latestKey,
                      artifactId: latest?.id,
                      filename,
                      version: latestVersion,
                      sizeBytes: latest?.sizeBytes,
                      riskStatus: applicationArchived
                        ? 'applicationArchived'
                        : latest
                          ? getArtifactRiskStatus(latest)
                          : null,
                    })
                  }}
                >
                  {downloading ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Download className="size-3.5" strokeWidth={1.75} />
                  )}
                  <span className="font-medium">{downloadLabel}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {downloadTooltip}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {hasVersion ? (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="border-0 bg-muted/40 ring-1 ring-border/60"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="size-3.5" strokeWidth={1.75} />
              {t('share.action')}
            </Button>
          ) : null}
          {canWrite && !applicationArchived ? (
            <Button asChild size="lg">
              <Link to={`/upload?app=${application.id}`}>
                <Upload className="size-3.5" strokeWidth={1.75} />
                {t('detail.uploadArtifact')}
              </Link>
            </Button>
          ) : null}
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="text-muted-foreground lg:hidden"
          >
            <Link to="/">{t('detail.back')}</Link>
          </Button>
        </div>
        {hasVersion && latest?.buildNumber ? (
          <p className="text-right text-[0.6875rem] text-muted-foreground">
            {t('detail.downloadLatestHint', { build: latest.buildNumber })}
          </p>
        ) : !hasVersion ? (
          <p className="text-right text-[0.6875rem] text-muted-foreground">
            {t('detail.noLatestYet')}
          </p>
        ) : null}
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        applicationId={application.id}
        applicationName={application.name}
        artifact={latest}
        applicationArchived={applicationArchived}
      />
      {downloadConfirmation}
    </header>
  )
}
