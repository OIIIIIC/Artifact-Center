import { motion, useReducedMotion } from 'framer-motion'
import {
  Folder,
  ListChecks,
  Inbox,
  Plus,
  RefreshCw,
  SearchX,
  ServerCrash,
  Star,
  Upload,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApplicationFiltersBar } from '@/features/applications/application-filters'
import { BulkApplicationActionsDialog } from '@/features/applications/bulk-application-actions-dialog'
import { ApplicationGridSkeleton } from '@/features/applications/application-grid-skeleton'
import { ApplicationSearch } from '@/features/applications/application-search'
import { ApplicationScopeHeading } from '@/features/applications/application-scope-heading'
import { ApplicationScopePath } from '@/features/applications/application-scope-path'
import { AnimatedScopeAction } from '@/features/applications/animated-scope-action'
import { ApplicationTimeline } from '@/features/applications/application-timeline'
import { CompactDirectory } from '@/features/products/product-directory'
import { ApplicationDirectory } from '@/features/products/application-directory'
import { useProjects } from '@/features/products/use-projects'
import { ShareCollectionAction } from '@/features/share/share-collection-action'
import {
  useApplicationCatalog,
  useApplications,
} from '@/features/applications/use-applications'
import { usePersonalWorkspace } from '@/features/applications/use-personal-workspace'
import { useWorkspaceFilterPreferenceSync } from '@/features/applications/use-workspace-filter-preference-sync'
import { useRegions } from '@/features/regions/use-regions'
import { useContentScrollRestoration } from '@/hooks/use-content-scroll-restoration'
import { canWriteContent } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

import { useDirectorySummary } from '@/features/applications/use-directory-summary'
import { CollectionPagination } from '@/components/common/collection-pagination'

const easeOut = [0.2, 0, 0, 1] as const

export function ApplicationsPage() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const role = useAuthStore((s) => s.user?.role)
  const canCreateApplication = canWriteContent(role)
  const {
    regions,
    loading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useRegions()
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects()
  const summary = useDirectorySummary()
  const listStart = useRef<HTMLDivElement>(null)
  const [pageSearchParams, setPageSearchParams] = useSearchParams()
  const [bulkCodesOpen, setBulkCodesOpen] = useState(false)
  const catalogQuery = useApplicationCatalog(bulkCodesOpen)
  const catalog = catalogQuery.catalog
  const regionScope =
    pageSearchParams.get('product') ?? pageSearchParams.get('region') ?? 'all'
  const projectScope = pageSearchParams.get('project') ?? 'all'
  const responsibleOnly = pageSearchParams.get('scope') === 'mine'
  const favoriteOnly = pageSearchParams.get('favorites') === '1'
  const {
    workspace,
    favoriteIds,
    toggleFavorite,
    favoritePendingId,
    updatePreferences,
    loading: workspaceLoading,
  } = usePersonalWorkspace()
  const {
    loading,
    filtered,
    filters,
    setFilters,
    isEmptyCatalog,
    isSearchEmpty,
    error,
    refetch,
    refreshing,
    resultsPending,
    transitionKey,
    total,
    pagination,
  } = useApplications()

  useContentScrollRestoration({ ready: !loading })
  const toggleCardFavorite = useCallback(
    (id: string) => toggleFavorite(id, filtered.find((app) => app.id === id)?.name),
    [toggleFavorite, filtered],
  )

  const canUpload = Object.values(summary.data?.maintainableCounts ?? {}).some(
    (count) => count > 0,
  )

  const changeRegionScope = (next: string, project = 'all') => {
    setPageSearchParams(
      (current) => {
        const updated = new URLSearchParams(current)
        updated.delete('region')
        if (next === 'all') updated.delete('product')
        else updated.set('product', next)
        if (next === 'all' || project === 'all') updated.delete('project')
        else updated.set('project', project)
        return updated
      },
      { replace: true },
    )
  }

  const setFavoriteOnly = (enabled: boolean) => {
    setPageSearchParams(
      (current) => {
        const updated = new URLSearchParams(current)
        if (enabled) updated.set('favorites', '1')
        else updated.delete('favorites')
        return updated
      },
      { replace: true },
    )
  }

  const changeFilters = (next: typeof filters) => {
    setFilters(next)
  }

  const browseRegions = regions
  const resolvedRegionScope = regionScope
  const resolvedProjectScope = regionScope === 'all' ? 'all' : projectScope
  const selectedProduct = regions.find((p) => p.id === resolvedRegionScope)
  const selectedProject = projects.find(
    (p) => p.id === resolvedProjectScope && p.productId === resolvedRegionScope,
  )
  const directory = {
    products: browseRegions,
    projects,
    counts: summary.data,
    productId: resolvedRegionScope,
    projectId: resolvedProjectScope,
    onSelect: changeRegionScope,
    loading: productsLoading || projectsLoading || summary.isLoading,
    error: !!productsError || !!projectsError || summary.isError,
    onRetry: () => {
      void refetchProducts()
      void refetchProjects()
      void summary.refetch()
    },
  }
  const createSearch = new URLSearchParams()
  if (resolvedRegionScope !== 'all') createSearch.set('product', resolvedRegionScope)
  if (selectedProject) createSearch.set('project', selectedProject.id)
  const createHref = `/applications/new${createSearch.size ? `?${createSearch}` : ''}`

  useWorkspaceFilterPreferenceSync({
    current: workspace.preferences,
    next: {
      query: filters.query.trim().slice(0, 120),
      platform: filters.platform,
      sort: filters.sort,
      regionId: selectedProduct?.id ?? null,
      projectId: selectedProject?.id ?? null,
      favoriteOnly,
      responsibleOnly,
    },
    loading: workspaceLoading || productsLoading || projectsLoading,
    onPersist: updatePreferences,
  })

  const visibleApplications = filtered
  const hasActiveFilters =
    !!filters.query.trim() ||
    filters.platform !== 'all' ||
    favoriteOnly ||
    responsibleOnly

  const hasNoVisibleMatches =
    !loading && !error && !isEmptyCatalog && visibleApplications.length === 0

  return (
    <AppLayout
      contentClassName="scrollbar-subtle"
      breadcrumbs={[{ label: t('nav.applications') }]}
      sidebarDirectory={<ApplicationDirectory directory={directory} />}
    >
      <PageContainer rhythm="product">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="relative overflow-hidden rounded-2xl bg-card/80 px-5 py-6 ring-1 ring-border/60 sm:px-7 sm:py-7"
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[45%] overflow-hidden lg:block"
            aria-hidden
          >
            <span className="absolute inset-y-0 right-0 w-[82%] bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--muted-foreground)_18%,transparent)_1px,transparent_0)] [background-size:15px_15px] [mask-image:linear-gradient(to_left,black,transparent)]" />
          </div>

          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <ApplicationScopeHeading
                productId={resolvedRegionScope}
                projectId={resolvedProjectScope}
                product={selectedProduct}
                project={selectedProject}
                counts={summary.data}
                loading={directory.loading}
                error={directory.error}
              />

              {canCreateApplication || canUpload || role === 'admin' ? (
                <div className="-my-1 -mr-1 flex flex-wrap items-center justify-end">
                  <AnimatedScopeAction visible={role === 'admin'}>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => setBulkCodesOpen(true)}
                    >
                      <ListChecks className="size-3.5" strokeWidth={1.75} />
                      {t('applications.bulkActionsAction')}
                    </Button>
                  </AnimatedScopeAction>
                  <AnimatedScopeAction
                    visible={
                      resolvedRegionScope !== 'all' &&
                      !!selectedProduct &&
                      (resolvedProjectScope === 'all' || !!selectedProject) &&
                      (summary.data?.maintainableCounts[resolvedRegionScope] ?? 0) > 0
                    }
                  >
                    {selectedProduct ? (
                      <ShareCollectionAction
                        key={`${selectedProduct.id}:${resolvedProjectScope}`}
                        product={selectedProduct}
                        project={selectedProject}
                      />
                    ) : null}
                  </AnimatedScopeAction>
                  <div className="flex items-center gap-2 p-1">
                    {canCreateApplication ? (
                      <Button asChild size="lg">
                        <Link to={createHref}>
                          <Plus className="size-3.5" strokeWidth={1.75} />
                          {t('applications.newApplication')}
                        </Link>
                      </Button>
                    ) : null}
                    {canUpload ? (
                      <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className={cn(
                          'border-0 bg-background/75 font-medium text-muted-foreground',
                          'ring-1 ring-border/60 backdrop-blur-sm',
                          'hover:bg-muted/55 hover:text-foreground hover:ring-border',
                          'dark:bg-muted/25 dark:hover:bg-muted/35',
                        )}
                      >
                        <Link to="/upload">
                          <Upload className="size-3.5" strokeWidth={1.75} />
                          {t('applications.uploadArtifact')}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-6">
              <div className="min-w-0 shrink-0 sm:flex-1 sm:shrink">
                <ApplicationScopePath
                  productId={resolvedRegionScope}
                  projectId={resolvedProjectScope}
                  product={selectedProduct}
                  project={selectedProject}
                  onSelect={changeRegionScope}
                />
              </div>
              <ApplicationSearch
                value={filters.query}
                onChange={(query) => changeFilters({ ...filters, query })}
                className="min-w-0 max-w-[34rem] flex-1"
              />
            </div>
          </div>
        </motion.section>

        <div ref={listStart} className="mt-5 scroll-mt-5 sm:mt-6">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07, duration: 0.34, ease: easeOut }}
            className="overflow-hidden rounded-2xl bg-card/80 ring-1 ring-border/60"
          >
            <div className="p-3 sm:px-4 sm:py-3.5">
              <ApplicationFiltersBar
                filters={filters}
                onChange={changeFilters}
                meta={
                  hasActiveFilters && !error
                    ? loading || resultsPending
                      ? t('common.loading')
                      : t('applications.filteredCount', { count: total })
                    : undefined
                }
                trailing={
                  <Button
                    type="button"
                    size="sm"
                    variant={favoriteOnly ? 'secondary' : 'ghost'}
                    aria-pressed={favoriteOnly}
                    onClick={() => setFavoriteOnly(!favoriteOnly)}
                    className="text-muted-foreground data-[pressed=true]:text-foreground"
                    data-pressed={favoriteOnly}
                  >
                    <Star
                      className="size-3.5"
                      fill={favoriteOnly ? 'currentColor' : 'none'}
                      strokeWidth={1.8}
                    />
                    {t('applications.favoritesOnly')}
                  </Button>
                }
              />
            </div>

            <div className="border-t border-border/60 p-3 lg:hidden">
              <CompactDirectory {...directory} />
            </div>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.38, ease: easeOut }}
            className="mt-6"
          >
            {loading ? (
              <div aria-busy="true" aria-live="polite">
                <p className="sr-only">{t('applications.loading')}</p>
                <ApplicationGridSkeleton />
              </div>
            ) : null}

            {!loading && error ? (
              <EmptyState
                icon={ServerCrash}
                title={t('common.serviceUnavailableTitle')}
                description={t('common.serviceUnavailableDescription')}
                action={
                  <Button type="button" size="lg" onClick={() => void refetch()}>
                    <RefreshCw className="size-3.5" strokeWidth={1.75} />
                    {t('common.retry')}
                  </Button>
                }
              />
            ) : null}

            {!loading && isEmptyCatalog ? (
              <EmptyState
                icon={Inbox}
                title={t('applications.emptyTitle')}
                description={t('applications.emptyDescription')}
                action={
                  canCreateApplication ? (
                    <Button asChild size="lg">
                      <Link to={createHref}>
                        <Plus className="size-3.5" strokeWidth={1.75} />
                        {t('applications.newApplication')}
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : null}

            {!loading && (isSearchEmpty || hasNoVisibleMatches) ? (
              <EmptyState
                icon={favoriteOnly ? Star : selectedProject ? Folder : SearchX}
                title={
                  favoriteOnly
                    ? t('applications.favoritesEmptyTitle')
                    : selectedProject &&
                        summary.data?.projectCounts[selectedProject.id] === undefined
                      ? t('directory.emptyProject')
                      : t('applications.noMatchTitle')
                }
                description={
                  favoriteOnly
                    ? t('applications.favoritesEmptyDescription')
                    : selectedProject &&
                        summary.data?.projectCounts[selectedProject.id] === undefined
                      ? t('directory.emptyProjectHint')
                      : t('applications.noMatchDescription')
                }
                action={
                  selectedProject &&
                  summary.data?.projectCounts[selectedProject.id] === undefined &&
                  canCreateApplication &&
                  !favoriteOnly ? (
                    <Button asChild variant="outline">
                      <Link to={createHref}>
                        <Plus className="size-3.5" />
                        {t('applications.newApplication')}
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setFilters({ query: '', platform: 'all', sort: filters.sort })
                        setPageSearchParams(
                          { platform: 'all', sort: filters.sort },
                          { replace: true },
                        )
                      }}
                    >
                      {favoriteOnly
                        ? t('applications.showAllApplications')
                        : t('common.clearFilters')}
                    </Button>
                  )
                }
              />
            ) : null}

            {!loading && !isEmptyCatalog && !isSearchEmpty && !hasNoVisibleMatches ? (
              <ApplicationTimeline
                applications={visibleApplications}
                transitionKey={`${transitionKey}:${resolvedRegionScope}:${resolvedProjectScope}:${responsibleOnly ? 'mine' : 'all'}:${favoriteOnly ? 'favorites' : 'all'}`}
                refreshing={refreshing}
                favoriteIds={favoriteIds}
                favoritePendingId={favoritePendingId}
                onToggleFavorite={toggleCardFavorite}
              />
            ) : null}
            <CollectionPagination
              page={pagination.page}
              total={total}
              hasNext={pagination.hasNext}
              hasPrevious={pagination.hasPrevious}
              busy={pagination.busy}
              onNext={() => {
                pagination.next()
                listStart.current?.scrollIntoView({ block: 'start' })
              }}
              onPrevious={() => {
                pagination.previous()
                listStart.current?.scrollIntoView({ block: 'start' })
              }}
            />
          </motion.div>
        </div>
      </PageContainer>
      {bulkCodesOpen && (catalogQuery.loading || catalogQuery.error) ? (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 rounded-xl border border-border bg-card p-4 shadow-lg"
        >
          {catalogQuery.error ? (
            <Button onClick={() => void catalogQuery.refetch()}>
              {t('common.retry')}
            </Button>
          ) : (
            t('applications.loading')
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setBulkCodesOpen(false)
            }}
          >
            {t('common.cancel')}
          </Button>
        </div>
      ) : null}
      {bulkCodesOpen && !catalogQuery.loading && !catalogQuery.error ? (
        <BulkApplicationActionsDialog
          open
          onOpenChange={setBulkCodesOpen}
          applications={catalog}
        />
      ) : null}
    </AppLayout>
  )
}
