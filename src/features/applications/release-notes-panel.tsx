import { FileText, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Artifact } from '@/types/artifact'

interface ReleaseNotesPanelProps {
  artifacts: Artifact[]
  applicationId?: string
}

/**
 * Application Detail → Release notes tab.
 * Lists version notes from artifact history (mock-friendly, no separate CMS).
 */
export function ReleaseNotesPanel({ artifacts, applicationId }: ReleaseNotesPanelProps) {
  const { t } = useTranslation()

  const withNotes = artifacts.filter((a) => a.releaseNotes?.trim())
  const uploadTo = applicationId ? `/upload?app=${applicationId}` : '/upload'
  const hasArtifacts = artifacts.length > 0

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
          hasArtifacts ? undefined : (
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
        {withNotes.map((art) => (
          <li
            key={art.id}
            className={cn(
              'rounded-2xl bg-card/50 px-4 py-3.5 ring-1 ring-border/70',
              'dark:bg-card/30',
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[0.875rem] font-medium text-foreground">
                v{art.version}
                <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
                  {t('detail.build', { number: art.buildNumber })}
                </span>
              </p>
              <time
                dateTime={art.uploadedAt}
                className="text-[0.75rem] text-muted-foreground"
              >
                {formatRelativeTime(art.uploadedAt)}
              </time>
            </div>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {art.releaseNotes}
            </p>
            <p className="mt-2 text-[0.6875rem] text-muted-foreground/80">
              {art.uploader}
              {' · '}
              {art.filename}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
