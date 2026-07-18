import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CHANNEL_BADGE } from '@/features/upload/channel-meta'
import { formatFileSize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'
import type { ParsedArtifactFile, PublishError, VersionDraft } from '@/types/upload'

interface StepReviewProps {
  application: Application
  parsed: ParsedArtifactFile
  version: VersionDraft
  publishError: PublishError
}

function Row({
  label,
  value,
  mono,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-[0.875rem] text-foreground sm:text-right',
          mono && value && 'truncate font-mono text-[0.8125rem]',
        )}
      >
        {children ?? value}
      </dd>
    </div>
  )
}

export function StepReview({
  application,
  parsed,
  version,
  publishError,
}: StepReviewProps) {
  const { t } = useTranslation()

  return (
    <div className="w-full space-y-4">
      {publishError === 'upload_failed' ? (
        <p className="text-[0.8125rem] text-muted-foreground" role="alert">
          {t('upload.publishFailed', {
            defaultValue: 'Upload failed. Please try again.',
          })}
        </p>
      ) : null}
      {publishError === 'duplicate_artifact' ? (
        <div
          className={cn(
            'flex gap-3 rounded-xl bg-muted/40 px-4 py-3 ring-1 ring-border/70',
            'text-[0.8125rem] text-muted-foreground',
          )}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="font-medium text-foreground">{t('upload.duplicateTitle')}</p>
            <p className="mt-0.5">
              {t('upload.duplicateDesc', {
                version: version.version,
                name: application.name,
              })}
            </p>
          </div>
        </div>
      ) : null}

      <dl
        className={cn(
          'space-y-3.5 rounded-2xl bg-muted/25 p-5 ring-1 ring-border/60',
          'dark:bg-muted/15',
        )}
      >
        <Row label={t('upload.reviewApplication')} value={application.name} />
        <Row label={t('upload.reviewVersion')} value={`v${version.version}`} mono />
        <Row label={t('upload.reviewBuild')} value={version.buildNumber} mono />
        <Row
          label={t('upload.reviewPlatform')}
          value={version.platform ? t(`platform.${version.platform}`) : '—'}
        />
        <Row label={t('upload.reviewChannel')}>
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[0.75rem] font-medium',
              CHANNEL_BADGE[version.channel],
            )}
          >
            {t(`channel.${version.channel}`)}
          </span>
        </Row>
        <Row
          label={t('upload.reviewLatest')}
          value={version.markLatest ? t('common.yes') : t('common.no')}
        />
        <Row label={t('upload.reviewFile')} value={parsed.name} mono />
        <Row label={t('upload.reviewSize')} value={formatFileSize(parsed.sizeBytes)} />
        <Row
          label={t('upload.reviewHash')}
          value={`${parsed.hash.slice(0, 12)}…${parsed.hash.slice(-8)}`}
          mono
        />
        <div className="border-t border-border/50 pt-3.5">
          <dt className="text-[0.75rem] text-muted-foreground">
            {t('upload.reviewNotes')}
          </dt>
          <dd className="mt-1.5 text-[0.875rem] leading-relaxed whitespace-pre-wrap text-foreground">
            {version.releaseNotes.trim() || (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
