import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, LayoutGrid, RefreshCw, ServerCrash, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { PersonalWorkspace } from '@/features/applications/personal-workspace'
import { useApplicationCatalog } from '@/features/applications/use-applications'
import { usePersonalWorkspace } from '@/features/applications/use-personal-workspace'
import { buildRestoredApplicationSearch } from '@/features/applications/workspace-filter-preferences'
import { useAuthStore } from '@/store/auth-store'

const easeOut = [0.2, 0, 0, 1] as const

function WorkspaceSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10">
      <div>
        <div className="h-6 w-36 animate-pulse rounded-lg bg-muted/65" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl bg-muted/50"
              style={{ animationDelay: `${index * 70}ms` }}
            />
          ))}
        </div>
      </div>
      <div className="lg:border-l lg:border-border/60 lg:pl-8">
        <div className="h-6 w-28 animate-pulse rounded-lg bg-muted/65" />
        <div className="mt-5 space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl bg-muted/45"
              style={{ animationDelay: `${index * 70}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function WorkspacePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const user = useAuthStore((state) => state.user)
  const catalogQuery = useApplicationCatalog()
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspace,
    toggleFavorite,
    favoritePendingId,
  } = usePersonalWorkspace()

  const hasPersonalContent =
    workspace.favoriteApplicationIds.length > 0 ||
    workspace.recentApplications.length > 0 ||
    workspace.preferences.platform !== 'all' ||
    workspace.preferences.sort !== 'updated' ||
    workspace.preferences.regionId != null ||
    Boolean(workspace.preferences.query) ||
    workspace.preferences.favoriteOnly ||
    workspace.preferences.responsibleOnly
  const loading = catalogQuery.loading || workspaceLoading
  const error = catalogQuery.error ?? workspaceError

  return (
    <AppLayout breadcrumbs={[{ label: t('nav.workspace') }]}>
      <PageContainer
        rhythm="product"
        constrained={false}
        className="pt-6 pb-8 sm:pt-7 md:pt-8"
      >
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: easeOut }}
          className="mb-6 flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
              {t('workspace.greeting', { name: user?.name ?? '' })}
            </h1>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/?scope=mine">
                {t('workspace.myApplications')}
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Link>
            </Button>
            <Button asChild>
              <Link to="/">
                <LayoutGrid className="size-4" strokeWidth={1.75} />
                {t('workspace.browseApplications')}
              </Link>
            </Button>
          </div>
        </motion.header>

        {loading ? <WorkspaceSkeleton /> : null}

        {!loading && error ? (
          <EmptyState
            icon={ServerCrash}
            title={t('common.serviceUnavailableTitle')}
            description={t('common.serviceUnavailableDescription')}
            action={
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  void catalogQuery.refetch()
                  void refetchWorkspace()
                }}
              >
                <RefreshCw className="size-4" strokeWidth={1.75} />
                {t('common.retry')}
              </Button>
            }
          />
        ) : null}

        {!loading && !error && hasPersonalContent ? (
          <PersonalWorkspace
            applications={catalogQuery.catalog}
            workspace={workspace}
            favoritePendingId={favoritePendingId}
            onToggleFavorite={toggleFavorite}
            onRestoreFilters={(preferences) => {
              const search = buildRestoredApplicationSearch(preferences)
              navigate(`/${search ? `?${search}` : ''}`)
            }}
          />
        ) : null}

        {!loading && !error && !hasPersonalContent ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: easeOut }}
            className="mx-auto max-w-xl py-14 text-center"
          >
            <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/15">
              <Star className="size-5" strokeWidth={1.7} aria-hidden />
            </span>
            <h2 className="mt-4 text-[1rem] font-semibold text-foreground">
              {t('workspace.emptyTitle')}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[0.8125rem] leading-5 text-muted-foreground">
              {t('workspace.emptyDescription')}
            </p>
            <Button asChild size="lg" className="mt-5">
              <Link to="/">
                {t('workspace.chooseApplication')}
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Link>
            </Button>
          </motion.div>
        ) : null}
      </PageContainer>
    </AppLayout>
  )
}
