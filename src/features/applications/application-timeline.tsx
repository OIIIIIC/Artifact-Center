import { Package } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
  favoriteIds?: ReadonlySet<string>
  favoritePendingId?: string
  onToggleFavorite?: (applicationId: string) => void
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
  favoriteIds,
  favoritePendingId,
  onToggleFavorite,
}: ApplicationTimelineProps) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const groups = groupApplicationsByActivity(applications)

  return (
    <div className={cn('-mb-8', className)} aria-busy={refreshing}>
      <AnimatePresence initial={false}>
        {groups.map((group, index) => {
          const artifactCount = group.applications.reduce(
            (total, application) => total + application.artifactCount,
            0,
          )
          const isUnpublished = group.bucket === 'unpublished'

          return (
            <motion.section
              key={group.bucket}
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: reduceMotion ? 0 : 0.32, ease: [0.2, 0, 0, 1] },
                opacity: { duration: reduceMotion ? 0 : 0.16 },
              }}
              className="overflow-hidden"
            >
              <div className="relative pb-8 pl-6 pr-1 sm:pl-7">
                {index < groups.length - 1 ? (
                  <span
                    className="absolute top-6 bottom-0 left-[0.45rem] w-px bg-border/70 sm:left-[0.53rem]"
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
                    {t('applications.timeline.apps', {
                      count: group.applications.length,
                    })}
                    {!isUnpublished
                      ? ` · ${t('applications.timeline.artifacts', { count: artifactCount })}`
                      : ''}
                  </span>
                </div>
                <ApplicationGrid
                  applications={group.applications}
                  transitionKey={`${transitionKey}:${group.bucket}`}
                  refreshing={refreshing}
                  favoriteIds={favoriteIds}
                  favoritePendingId={favoritePendingId}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            </motion.section>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
