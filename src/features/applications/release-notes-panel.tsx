import { FileText, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApplicationStatus } from '@/types/application'
import type { Release } from '@/types/release'

interface ReleaseNotesPanelProps {
  releases: Release[]
  applicationId?: string
  applicationStatus?: ApplicationStatus
}

/**
 * Application Detail → Release notes tab.
 * Lists release notes from the server-side Release aggregate.
 */
export function ReleaseNotesPanel({
  releases,
  applicationId,
  applicationStatus,
}: ReleaseNotesPanelProps) {
  const { t } = useTranslation()

  const withNotes = releases.filter((release) => release.releaseNotes?.trim())
  const uploadTo = applicationId ? `/upload?app=${applicationId}` : '/upload'
  const hasArtifacts = releases.length > 0

  if (withNotes.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t('detail.releaseNotesEmptyTitle')}
        description={
          hasArtifacts
            ? t('detail.releaseNotesEmptyHasBuilds')
            : t('detail.releaseNotesEmptyDesc')
        }
        className="py-14"
        action={
          hasArtifacts || applicationStatus === 'archived' ? undefined : (
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
    <div className="space-y-4">
      <div>
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          {t('detail.releaseNotesTitle')}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {t('detail.releaseNotesHint')}
        </p>
      </div>

      <ul className="space-y-3">
        {withNotes.map((release) => (
          <li
            key={release.id}
            className={cn(
              'rounded-2xl bg-card/50 px-4 py-3.5 ring-1 ring-border/70',
              'dark:bg-card/30',
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[0.875rem] font-medium text-foreground">
                v{release.version}
                <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
                  {release.artifactCount} {t('detail.artifactsTitle')}
                </span>
              </p>
              <time
                dateTime={release.publishedAt}
                className="text-[0.75rem] text-muted-foreground"
              >
                {formatRelativeTime(release.publishedAt)}
              </time>
            </div>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {release.releaseNotes}
            </p>
            <p className="mt-2 text-[0.6875rem] text-muted-foreground/80">
              {release.createdBy}
              {release.artifactTypes.length
                ? ` · ${release.artifactTypes.join(' / ').toUpperCase()}`
                : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
