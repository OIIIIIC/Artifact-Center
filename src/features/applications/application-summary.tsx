import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ArtifactReleaseBadges } from '@/features/applications/artifact-release-badges'
import { formatAbsoluteDate, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'

interface ApplicationSummaryProps {
  application: Application
  latest?: Artifact
  artifactCount: number
  className?: string
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {label}
      </dt>
      <dd className="min-w-0 text-[0.875rem] text-foreground">{children}</dd>
    </div>
  )
}

export function ApplicationSummary({
  application,
  latest,
  artifactCount,
  className,
}: ApplicationSummaryProps) {
  const { t, i18n } = useTranslation()
  void i18n.language
  const lastUpload = latest?.uploadedAt ?? application.updatedAt
  const latestVersion = latest?.version ?? application.latestVersion

  return (
    <section
      className={cn(
        'rounded-2xl bg-muted/25 ring-1 ring-border/60 dark:bg-muted/15 dark:ring-border/80',
        className,
      )}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4 lg:p-6">
        <Cell label={t('detail.latestVersion')}>
          {/*
            Context is already "latest version" — only show version + channel.
            Build / filename live on the header & download control; avoid repeating them here.
          */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="font-mono text-[0.875rem] font-medium text-foreground">
              {latestVersion
                ? t('detail.latestVersionValue', { version: latestVersion })
                : t('detail.noLatestYet')}
            </span>
            {latest ? (
              <ArtifactReleaseBadges artifact={latest} showLatest={false} />
            ) : null}
          </div>
        </Cell>
        <Cell label={t('detail.artifacts')}>{artifactCount}</Cell>
        <Cell label={t('detail.created')}>
          {formatAbsoluteDate(application.createdAt)}
        </Cell>
        <Cell label={t('detail.lastUpload')}>
          <time dateTime={lastUpload}>{formatRelativeTime(lastUpload)}</time>
        </Cell>
        <Cell label={t('detail.package')}>
          <span className="font-mono text-[0.75rem] text-muted-foreground">
            {application.packageName}
          </span>
        </Cell>
        <Cell label={t('detail.repository')}>
          <span className="font-mono text-[0.75rem] text-muted-foreground">
            {application.repository}
          </span>
        </Cell>
      </dl>
    </section>
  )
}
