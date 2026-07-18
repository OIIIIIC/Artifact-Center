import { Inbox, Plus, SearchX, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApplicationFiltersBar } from '@/features/applications/application-filters'
import { ApplicationGrid } from '@/features/applications/application-grid'
import { ApplicationGridSkeleton } from '@/features/applications/application-grid-skeleton'
import { ApplicationSearch } from '@/features/applications/application-search'
import { useApplications } from '@/features/applications/use-applications'
import { canWriteContent } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

export function ApplicationsPage() {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.user?.role)
  const canWrite = canWriteContent(role)
  const { loading, filtered, filters, setFilters, isEmptyCatalog, isSearchEmpty } =
    useApplications()

  return (
    <AppLayout breadcrumbs={[{ label: t('nav.applications') }]}>
      <PageContainer rhythm="product">
        <div className="space-y-6 sm:space-y-7">
          <PageHeader
            title={t('applications.title')}
            description={t('applications.description')}
            action={
              canWrite ? (
                <div className="flex flex-wrap items-center gap-2">
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
            className="min-w-0 w-full"
          />
        </div>

        <div className="mt-8 space-y-5 sm:mt-9">
          <ApplicationFiltersBar
            filters={filters}
            onChange={setFilters}
            meta={
              !loading && !isEmptyCatalog && !isSearchEmpty
                ? t('applications.count', { count: filtered.length })
                : !loading && isSearchEmpty
                  ? t('applications.count', { count: 0 })
                  : undefined
            }
          />

          {loading ? (
            <div aria-busy="true" aria-live="polite">
              <p className="sr-only">{t('applications.loading')}</p>
              <ApplicationGridSkeleton />
            </div>
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

          {!loading && isSearchEmpty ? (
            <EmptyState
              icon={SearchX}
              title={t('applications.noMatchTitle')}
              description={t('applications.noMatchDescription')}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setFilters({
                      query: '',
                      platform: 'all',
                      sort: filters.sort,
                    })
                  }
                >
                  {t('common.clearFilters')}
                </Button>
              }
            />
          ) : null}

          {!loading && !isEmptyCatalog && !isSearchEmpty ? (
            <ApplicationGrid applications={filtered} />
          ) : null}
        </div>
      </PageContainer>
    </AppLayout>
  )
}
