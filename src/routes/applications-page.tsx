import {
  Braces,
  Inbox,
  Plus,
  RefreshCw,
  SearchX,
  ServerCrash,
  Share2,
  Upload,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApplicationFiltersBar } from '@/features/applications/application-filters'
import { BulkApplicationCodeDialog } from '@/features/applications/bulk-application-code-dialog'
import { ApplicationGridSkeleton } from '@/features/applications/application-grid-skeleton'
import { ApplicationSearch } from '@/features/applications/application-search'
import { ApplicationTimeline } from '@/features/applications/application-timeline'
import { RegionSwitcher } from '@/features/applications/region-switcher'
import { ShareCollectionDialog } from '@/features/share/share-collection-dialog'
import {
  useApplicationCatalog,
  useApplications,
} from '@/features/applications/use-applications'
import { useRegions } from '@/features/regions/use-regions'
import { useContentScrollRestoration } from '@/hooks/use-content-scroll-restoration'
import { canWriteContent } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

export function ApplicationsPage() {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.user?.role)
  const canWrite = canWriteContent(role)
  const { regions } = useRegions()
  const { catalog } = useApplicationCatalog()
  const [shareRegionId, setShareRegionId] = useState<string | null>(null)
  const [bulkCodesOpen, setBulkCodesOpen] = useState(false)
  const [regionScope, setRegionScope] = useState('all')
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
    transitionKey,
  } = useApplications()

  useContentScrollRestoration({ ready: !loading })

  const changeRegionScope = (next: string) => {
    setRegionScope(next)
  }

  const regionCounts = useMemo(
    () =>
      catalog.reduce<Record<string, number>>((counts, application) => {
        counts[application.region.id] = (counts[application.region.id] ?? 0) + 1
        return counts
      }, {}),
    [catalog],
  )

  const browseRegions = useMemo(
    () => regions.filter((region) => (regionCounts[region.id] ?? 0) > 0),
    [regionCounts, regions],
  )

  const resolvedRegionScope =
    regionScope === 'all' || browseRegions.some((region) => region.id === regionScope)
      ? regionScope
      : 'all'

  const visibleApplications = useMemo(
    () =>
      resolvedRegionScope === 'all'
        ? filtered
        : filtered.filter((application) => application.region.id === resolvedRegionScope),
    [filtered, resolvedRegionScope],
  )

  const hasNoVisibleMatches =
    !loading && !error && !isEmptyCatalog && visibleApplications.length === 0
  const shareRegion = regions.find((region) => region.id === shareRegionId)

  return (
    <AppLayout breadcrumbs={[{ label: t('nav.applications') }]}>
      <PageContainer rhythm="product">
        <section className="relative overflow-hidden rounded-2xl bg-card/80 px-5 py-6 ring-1 ring-border/60 sm:px-7 sm:py-7">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[45%] overflow-hidden lg:block"
            aria-hidden
          >
            <span className="absolute top-[23%] right-[30%] size-16 rounded-[1.25rem] border border-primary/10 bg-primary/[0.04] shadow-[0_20px_40px_-24px_color-mix(in_oklch,var(--primary),transparent_30%)]" />
            <span className="absolute top-[38%] right-[58%] size-24 rounded-full bg-cyan-300/15 blur-sm dark:bg-cyan-300/8" />
            <span className="absolute right-[8%] bottom-[-26%] size-64 rounded-full border border-border/60" />
            <span className="absolute right-[21%] bottom-[-35%] size-64 rounded-full border border-primary/10" />
            <span className="absolute top-[49%] right-[16%] size-10 rotate-45 rounded-lg bg-foreground/8 shadow-sm" />
            <span className="absolute top-[65%] right-[35%] size-7 rotate-45 rounded-md bg-foreground/10" />
          </div>

          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="text-[1.875rem] leading-tight font-semibold tracking-tight text-foreground sm:text-[2.125rem]">
                    {t('applications.title')}
                  </h1>
                  {!loading ? (
                    <span className="text-[0.8125rem] text-muted-foreground">
                      {t('applications.count', { count: catalog.length })}
                    </span>
                  ) : null}
                </div>
              </div>

              {canWrite ? (
                <div className="flex flex-wrap items-center gap-2">
                  {role === 'admin' ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => setBulkCodesOpen(true)}
                    >
                      <Braces className="size-3.5" strokeWidth={1.75} />
                      {t('applications.bulkCodeAction')}
                    </Button>
                  ) : null}
                  {resolvedRegionScope !== 'all' && resolvedRegionScope ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => setShareRegionId(resolvedRegionScope)}
                    >
                      <Share2 className="size-3.5" strokeWidth={1.75} />
                      {t('share.collectionAction')}
                    </Button>
                  ) : null}
                  <Button asChild size="lg">
                    <Link to="/applications/new">
                      <Plus className="size-3.5" strokeWidth={1.75} />
                      {t('applications.newApplication')}
                    </Link>
                  </Button>
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
                </div>
              ) : null}
            </div>

            <ApplicationSearch
              value={filters.query}
              onChange={(query) => setFilters({ ...filters, query })}
              className="w-full max-w-[34rem]"
            />
          </div>
        </section>

        <div className="mt-5 space-y-6 sm:mt-6">
          <div className="overflow-hidden rounded-2xl bg-card/80 ring-1 ring-border/60">
            <div className="p-3 sm:px-4 sm:py-3.5">
              <ApplicationFiltersBar
                filters={filters}
                onChange={setFilters}
                meta={
                  !loading && !isEmptyCatalog && !isSearchEmpty
                    ? t('applications.count', { count: visibleApplications.length })
                    : !loading && isSearchEmpty
                      ? t('applications.count', { count: 0 })
                      : undefined
                }
              />
            </div>

            {!loading && !error && browseRegions.length > 0 ? (
              <div className="border-t border-border/60 px-3 py-3 sm:px-4">
                <RegionSwitcher
                  regions={browseRegions}
                  selected={resolvedRegionScope}
                  counts={regionCounts}
                  onChange={changeRegionScope}
                />
              </div>
            ) : null}
          </div>

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
                canWrite ? (
                  <Button asChild size="lg">
                    <Link to="/applications/new">
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
              icon={SearchX}
              title={t('applications.noMatchTitle')}
              description={t('applications.noMatchDescription')}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setFilters({
                      query: '',
                      platform: 'all',
                      sort: filters.sort,
                    })
                    changeRegionScope('all')
                  }}
                >
                  {t('common.clearFilters')}
                </Button>
              }
            />
          ) : null}

          {!loading && !isEmptyCatalog && !isSearchEmpty && !hasNoVisibleMatches ? (
            <ApplicationTimeline
              applications={visibleApplications}
              transitionKey={`${transitionKey}:${resolvedRegionScope}`}
              refreshing={refreshing}
            />
          ) : null}
        </div>
      </PageContainer>
      {shareRegion ? (
        <ShareCollectionDialog
          key={shareRegion.id}
          open
          onOpenChange={(open) => {
            if (!open) setShareRegionId(null)
          }}
          region={shareRegion}
          applications={catalog.filter(
            (application) => application.region.id === shareRegion.id,
          )}
        />
      ) : null}
      {bulkCodesOpen ? (
        <BulkApplicationCodeDialog
          open
          onOpenChange={setBulkCodesOpen}
          applications={catalog}
        />
      ) : null}
    </AppLayout>
  )
}
