import {
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
import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApplicationFiltersBar } from '@/features/applications/application-filters'
import { ApplicationGrid } from '@/features/applications/application-grid'
import { ApplicationGridSkeleton } from '@/features/applications/application-grid-skeleton'
import { ApplicationSearch } from '@/features/applications/application-search'
import { RegionSwitcher } from '@/features/applications/region-switcher'
import { ShareCollectionDialog } from '@/features/share/share-collection-dialog'
import {
  useApplicationCatalog,
  useApplications,
} from '@/features/applications/use-applications'
import { useRegions } from '@/features/regions/use-regions'
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
  } = useApplications()

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
        <section className="border-b border-border/60 pb-7 sm:pb-8">
          <div className="flex min-h-[11rem] flex-col lg:min-h-[12rem]">
            <PageHeader
              title={t('applications.title')}
              description={t('applications.description')}
              action={
                canWrite ? (
                  <div className="flex flex-wrap items-center gap-2">
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
                        'border-0 bg-muted/40 font-medium text-muted-foreground',
                        'ring-1 ring-border/60',
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
                ) : undefined
              }
            />

            <ApplicationSearch
              value={filters.query}
              onChange={(query) => setFilters({ ...filters, query })}
              className="mt-auto w-full max-w-[40rem]"
            />
          </div>
        </section>

        <div className="mt-7 space-y-6 sm:mt-8">
          <div className="space-y-3 rounded-xl bg-card p-3 ring-1 ring-border/60">
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

            {!loading && !error && browseRegions.length > 0 ? (
              <div className="border-t border-border/60 pt-3">
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
            <ApplicationGrid applications={visibleApplications} />
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
    </AppLayout>
  )
}
