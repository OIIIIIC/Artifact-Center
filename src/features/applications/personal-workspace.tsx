import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion'
import { ArrowRight, Clock3, SlidersHorizontal, Star } from 'lucide-react'
import { useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { ApplicationAvatar } from '@/features/applications/application-avatar'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  PersonalWorkspace as PersonalWorkspaceData,
  PersonalWorkspacePreferences,
} from '@/services/api'
import type { Application } from '@/types/application'

type PersonalWorkspaceProps = {
  applications: Application[]
  workspace: PersonalWorkspaceData
  favoritePendingId?: string
  onToggleFavorite: (applicationId: string) => void
  onRestoreFilters: (preferences: PersonalWorkspacePreferences) => void
}

const easeOut = [0.2, 0, 0, 1] as const

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } },
}

function FavoriteApplicationCard({
  application,
  pending,
  onToggleFavorite,
}: {
  application: Application
  pending: boolean
  onToggleFavorite: () => void
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const PlatformIcon = PLATFORM_ICON[application.platform]
  const pointerX = useMotionValue(160)
  const pointerY = useMotionValue(88)
  const rotateX = useSpring(0, { stiffness: 240, damping: 26, mass: 0.7 })
  const rotateY = useSpring(0, { stiffness: 240, damping: 26, mass: 0.7 })
  const surfaceShade = useMotionTemplate`radial-gradient(260px circle at ${pointerX}px ${pointerY}px, color-mix(in oklch, var(--foreground) 4%, transparent), transparent 70%)`

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    pointerX.set(x)
    pointerY.set(y)
    rotateX.set(((bounds.height / 2 - y) / bounds.height) * 8)
    rotateY.set(((x - bounds.width / 2) / bounds.width) * 10)
  }

  const resetTilt = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <motion.article
      variants={itemVariants}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -7,
              scale: 1.012,
              transition: { type: 'spring', stiffness: 320, damping: 24, mass: 0.65 },
            }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      style={{
        rotateX: reduceMotion ? 0 : rotateX,
        rotateY: reduceMotion ? 0 : rotateY,
        transformPerspective: 900,
        transformStyle: 'preserve-3d',
      }}
      className={cn(
        'group relative min-h-44 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 will-change-transform',
        'shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] duration-300 ease-out',
        'hover:border-foreground/20 hover:shadow-[0_20px_42px_-28px_rgb(0_0_0/0.38)] focus-within:border-foreground/20 focus-within:shadow-[0_20px_42px_-28px_rgb(0_0_0/0.38)] dark:hover:shadow-[0_24px_48px_-30px_rgb(0_0_0/0.72)] dark:focus-within:shadow-[0_24px_48px_-30px_rgb(0_0_0/0.72)]',
      )}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ background: surfaceShade }}
        aria-hidden
      />
      <Link
        to={`/applications/${application.id}`}
        state={{ returnTo: `${location.pathname}${location.search}` }}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset"
        aria-label={application.name}
      />

      {/* The transformed header needs its own layer above the full-card link.
          Only the star receives clicks; the avatar area still opens details. */}
      <div className="pointer-events-none relative z-20 flex items-start justify-between gap-4 [transform:translateZ(24px)]">
        <motion.div
          className="rounded-xl transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-110 group-focus-within:-rotate-3 group-focus-within:scale-110"
          aria-hidden
        >
          <ApplicationAvatar application={application} className="size-11" />
        </motion.div>
        <button
          type="button"
          disabled={pending}
          onClick={onToggleFavorite}
          aria-label={t('applications.workspace.removeFavorite', {
            name: application.name,
          })}
          className="pointer-events-auto relative z-20 inline-flex size-8 items-center justify-center rounded-full text-amber-500 transition-[background-color,transform,box-shadow] duration-300 hover:scale-110 hover:bg-amber-500/12 hover:shadow-[0_0_20px_color-mix(in_oklch,var(--color-amber-500)_35%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-wait disabled:opacity-50 [transform:translateZ(30px)]"
        >
          <motion.span
            animate={
              pending
                ? { scale: [1, 0.82, 1], rotate: [0, -12, 12, 0] }
                : { scale: 1, rotate: 0 }
            }
            transition={{ duration: 0.45, repeat: pending ? Infinity : 0 }}
          >
            <Star className="size-4" fill="currentColor" strokeWidth={1.8} aria-hidden />
          </motion.span>
        </button>
      </div>

      <div className="relative mt-4 pr-2 [transform:translateZ(18px)]">
        <h3 className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground">
          {application.name}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-[0.75rem] leading-5 text-muted-foreground">
          {application.description}
        </p>
      </div>

      <div className="relative mt-3 flex min-w-0 items-center gap-1.5 text-[0.6875rem] text-muted-foreground [transform:translateZ(16px)]">
        <PlatformIcon className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden />
        <span className="truncate">{application.region.name}</span>
        {application.latestVersion ? (
          <>
            <span className="text-border-strong" aria-hidden>
              ·
            </span>
            <span className="shrink-0 font-mono text-foreground/75">
              v{application.latestVersion}
            </span>
          </>
        ) : null}
      </div>
    </motion.article>
  )
}

function RecentApplicationLink({
  application,
  viewedAt,
}: {
  application: Application
  viewedAt: string
}) {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <motion.li variants={itemVariants}>
      <Link
        to={`/applications/${application.id}`}
        state={{ returnTo: `${location.pathname}${location.search}` }}
        className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-3 transition-[background-color,transform] duration-200 ease-out hover:translate-x-1 hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
      >
        <ApplicationAvatar
          application={application}
          className="size-9"
          iconClassName="size-4"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-medium text-foreground">
            {application.name}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
            <span className="truncate">{application.region.name}</span>
            {application.latestVersion ? (
              <>
                <span aria-hidden>·</span>
                <span className="shrink-0 font-mono">v{application.latestVersion}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-right text-[0.625rem] text-muted-foreground/75">
          {t('applications.workspace.visited', {
            time: formatRelativeTime(viewedAt),
          })}
        </span>
      </Link>
    </motion.li>
  )
}

export function PersonalWorkspace({
  applications,
  workspace,
  favoritePendingId,
  onToggleFavorite,
  onRestoreFilters,
}: PersonalWorkspaceProps) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const applicationById = useMemo(
    () => new Map(applications.map((application) => [application.id, application])),
    [applications],
  )
  const favorites = workspace.favoriteApplicationIds
    .map((id) => applicationById.get(id))
    .filter((application): application is Application => Boolean(application))
  const visibleFavorites = favorites.slice(0, 12)
  const recent = workspace.recentApplications
    .map((visit) => ({ ...visit, application: applicationById.get(visit.applicationId) }))
    .filter(
      (
        visit,
      ): visit is typeof visit & {
        application: Application
      } => Boolean(visit.application),
    )
    .slice(0, 5)
  const hasSavedFilters =
    workspace.preferences.platform !== 'all' ||
    workspace.preferences.sort !== 'updated' ||
    workspace.preferences.regionId != null ||
    Boolean(workspace.preferences.query) ||
    workspace.preferences.favoriteOnly ||
    workspace.preferences.responsibleOnly
  const savedRegionName = workspace.preferences.regionId
    ? applications.find(
        (application) => application.region.id === workspace.preferences.regionId,
      )?.region.name
    : undefined
  const savedFilterSummary = [
    t(`platform.${workspace.preferences.platform}`),
    savedRegionName,
    t(`sort.${workspace.preferences.sort}`),
    workspace.preferences.responsibleOnly
      ? t('applications.workspace.myApplications')
      : undefined,
    workspace.preferences.favoriteOnly ? t('applications.favoritesOnly') : undefined,
    workspace.preferences.query
      ? t('applications.workspace.savedFilterQuery', {
          query: workspace.preferences.query,
        })
      : undefined,
  ]
    .filter((label): label is string => Boolean(label))
    .join(' · ')
  const hasContent = favorites.length > 0 || recent.length > 0 || hasSavedFilters

  if (!hasContent) return null

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: easeOut }}
      aria-label={t('applications.workspace.eyebrow')}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-12 2xl:grid-cols-[minmax(0,1fr)_28rem] 2xl:gap-14">
        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Star
                  className="size-4 text-amber-500"
                  fill="currentColor"
                  strokeWidth={1.8}
                />
                <h2 className="text-[1rem] font-semibold tracking-tight text-foreground">
                  {t('applications.workspace.favorites')}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium tabular-nums text-muted-foreground">
                  {t('applications.workspace.favoritesCount', {
                    count: favorites.length,
                  })}
                </span>
              </div>
            </div>
          </div>

          {visibleFavorites.length > 0 ? (
            <motion.div
              variants={reduceMotion ? undefined : listVariants}
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
              {visibleFavorites.map((application) => (
                <FavoriteApplicationCard
                  key={application.id}
                  application={application}
                  pending={favoritePendingId === application.id}
                  onToggleFavorite={() => onToggleFavorite(application.id)}
                />
              ))}
            </motion.div>
          ) : (
            <div className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-border/70 px-6 text-center text-[0.75rem] leading-5 text-muted-foreground">
              {t('applications.workspace.noFavorites')}
            </div>
          )}

          {favorites.length > visibleFavorites.length ? (
            <div className="mt-4 flex justify-end">
              <Link
                to="/?favorites=1"
                className="group/all inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium text-muted-foreground transition-colors hover:bg-muted/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              >
                {t('applications.workspace.viewAllFavorites', {
                  count: favorites.length,
                })}
                <ArrowRight
                  className="size-3.5 transition-transform group-hover/all:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </Link>
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 self-start lg:border-l lg:border-border/60 lg:pl-8">
          <div className="mb-2 flex items-center gap-2">
            <Clock3 className="size-4 text-primary" strokeWidth={1.8} />
            <h2 className="text-[1rem] font-semibold tracking-tight text-foreground">
              {t('applications.workspace.recent')}
            </h2>
          </div>

          {recent.length > 0 ? (
            <motion.ol
              variants={reduceMotion ? undefined : listVariants}
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              className="divide-y divide-border/55"
            >
              {recent.map((visit) => (
                <RecentApplicationLink
                  key={visit.applicationId}
                  application={visit.application}
                  viewedAt={visit.viewedAt}
                />
              ))}
            </motion.ol>
          ) : (
            <p className="rounded-xl bg-muted/35 px-4 py-6 text-center text-[0.75rem] leading-5 text-muted-foreground">
              {t('applications.workspace.noRecent')}
            </p>
          )}
          {hasSavedFilters ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.3, ease: easeOut }}
              className="mt-6 border-t border-border/60 pt-4"
            >
              <button
                type="button"
                onClick={() => onRestoreFilters(workspace.preferences)}
                aria-label={t('applications.workspace.restoreFilters')}
                className="group/filter flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left text-[0.75rem] text-muted-foreground transition-colors hover:bg-muted/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                  <SlidersHorizontal className="size-3.5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    {t('applications.workspace.restoreFilters')}
                    <ArrowRight className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <span className="mt-1 block leading-5 break-words">
                    {t('applications.workspace.savedFilters', {
                      filters: savedFilterSummary,
                    })}
                  </span>
                </span>
              </button>
            </motion.div>
          ) : null}
        </aside>
      </div>
    </motion.section>
  )
}
