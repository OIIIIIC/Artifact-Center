import { Inbox, SearchX, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApplicationFiltersBar } from '@/features/applications/application-filters'
import { ApplicationGrid } from '@/features/applications/application-grid'
import { ApplicationGridSkeleton } from '@/features/applications/application-grid-skeleton'
import { ApplicationSearch } from '@/features/applications/application-search'
import { useApplications } from '@/features/applications/use-applications'
import { cn } from '@/lib/utils'

/**
 * Applications home — README screenshot quality.
 * Copy policy (Scheme B): product terms in English; descriptive body in Chinese.
 */
export function ApplicationsPage() {
  const { loading, filtered, filters, setFilters, isEmptyCatalog, isSearchEmpty } =
    useApplications()

  return (
    <AppLayout breadcrumbs={[{ label: 'Applications' }]} showSearch={false}>
      <PageContainer className="pb-24 pt-9 sm:pt-11 md:pt-12">
        {/* Header + Search: one continuous stack, search is the focus */}
        <div className="space-y-6 sm:space-y-7">
          <header className="max-w-2xl space-y-1.5">
            <h1 className="text-[1.875rem] leading-tight font-semibold tracking-tight text-foreground sm:text-[2rem] md:text-[2.125rem]">
              Applications
            </h1>
            <p className="text-[0.875rem] leading-relaxed text-muted-foreground/85">
              浏览企业内部应用，查找并进入制品。
            </p>
          </header>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ApplicationSearch
              value={filters.query}
              onChange={(query) => setFilters({ ...filters, query })}
              className="min-w-0 flex-1"
            />
            <Button
              asChild
              variant="outline"
              className={cn(
                'h-12 shrink-0 gap-2 rounded-xl px-4',
                'border-0 bg-muted/40 text-[0.8125rem] font-medium text-muted-foreground',
                'ring-1 ring-border/60',
                'transition-[color,background-color,ring-color] duration-[var(--duration-hover)]',
                'hover:bg-muted/55 hover:text-foreground hover:ring-border',
                'dark:bg-muted/25 dark:hover:bg-muted/35',
              )}
            >
              <Link to="/upload">
                <Upload className="size-3.5" strokeWidth={1.75} />
                Upload Artifact
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-5 sm:mt-9">
          <ApplicationFiltersBar
            filters={filters}
            onChange={setFilters}
            meta={
              !loading && !isEmptyCatalog && !isSearchEmpty
                ? `${filtered.length} applications`
                : !loading && isSearchEmpty
                  ? '0 applications'
                  : undefined
            }
          />

          {loading ? (
            <div aria-busy="true" aria-live="polite">
              <p className="sr-only">Loading applications</p>
              <ApplicationGridSkeleton />
            </div>
          ) : null}

          {!loading && isEmptyCatalog ? (
            <EmptyState
              icon={Inbox}
              title="No applications yet"
              description="上传第一个 Artifact 后，应用会出现在这里。"
              action={
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-lg border-0 bg-muted/40 ring-1 ring-border/70"
                >
                  <Link to="/upload">
                    <Upload className="size-3.5" strokeWidth={1.75} />
                    Upload Artifact
                  </Link>
                </Button>
              }
            />
          ) : null}

          {!loading && isSearchEmpty ? (
            <EmptyState
              icon={SearchX}
              title="No matching applications"
              description="换个关键词，或清除筛选后再试。"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setFilters({
                      query: '',
                      platform: 'all',
                      sort: filters.sort,
                    })
                  }
                >
                  Clear filters
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
