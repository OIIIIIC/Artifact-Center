import { Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { groupApplicationsByActivity } from '@/features/applications/application-activity'
import { ApplicationGrid } from '@/features/applications/application-grid'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'

interface ApplicationTimelineProps {
  applications: Application[]
  transitionKey?: string
  refreshing?: boolean
  className?: string
}

/**
 * Browse applications in release-time sections so packages do not get lost
 * among applications that have not published an artifact yet.
 */
export function ApplicationTimeline({
  applications,
  transitionKey = 'timeline',
  refreshing = false,
  className,
}: ApplicationTimelineProps) {
  const { t } = useTranslation()
  const groups = groupApplicationsByActivity(applications)

  return (
    <div className={cn('space-y-8', className)} aria-busy={refreshing}>
      {groups.map((group, index) => {
        const artifactCount = group.applications.reduce(
          (total, application) => total + application.artifactCount,
          0,
        )
        const isUnpublished = group.bucket === 'unpublished'

        return (
          <section key={group.bucket} className="relative pl-6 sm:pl-7">
            {index < groups.length - 1 ? (
              <span
                className="absolute top-6 bottom-[-2rem] left-[0.45rem] w-px bg-border/70 sm:left-[0.53rem]"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'absolute top-1.5 left-0 flex size-[0.9375rem] items-center justify-center rounded-full ring-4 ring-background',
                isUnpublished ? 'bg-muted-foreground/35' : 'bg-primary',
              )}
              aria-hidden
            >
              <Package className="size-2.5 text-primary-foreground" strokeWidth={2} />
            </span>

            <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                {t(`applications.timeline.${group.bucket}`)}
              </h2>
              <span className="text-[0.75rem] text-muted-foreground">
                {t('applications.timeline.apps', { count: group.applications.length })}
                {!isUnpublished
                  ? ` · ${t('applications.timeline.artifacts', { count: artifactCount })}`
                  : ''}
              </span>
            </div>
            <ApplicationGrid
              applications={group.applications}
              transitionKey={`${transitionKey}:${group.bucket}`}
              refreshing={refreshing}
            />
          </section>
        )
      })}
    </div>
  )
}
