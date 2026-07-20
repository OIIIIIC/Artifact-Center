import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { FileBox, LayoutGrid, Loader2, Search, SearchX } from 'lucide-react'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { Input } from '@/components/ui/input'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useServerSearch } from '@/features/search/use-server-search'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Full-page search results — Applications / Artifacts groups.
 * Same shell width & page header as Applications / Settings.
 */
export function SearchPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''

  const { results, loading } = useServerSearch(query, {
    applications: 40,
    artifacts: 60,
  })

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  const hasQuery = query.trim().length > 0
  const empty = hasQuery && !loading && results.total === 0

  return (
    <AppLayout breadcrumbs={[{ label: t('search.pageTitle') }]}>
      <PageContainer rhythm="product">
        <div className="space-y-6 sm:space-y-7">
          <PageHeader title={t('search.pageTitle')} description={t('search.pageDesc')} />

          <div className="relative w-full">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              className="h-10 w-full rounded-xl pl-10 text-[0.875rem]"
              autoFocus
            />
          </div>
        </div>

        <div className="mt-8 space-y-5 sm:mt-9">
          {!hasQuery ? (
            <EmptyState
              icon={Search}
              title={t('search.startTitle')}
              description={t('search.startDesc')}
            />
          ) : null}

          {hasQuery && loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              <span className="text-[0.8125rem]">{t('common.loading')}</span>
            </div>
          ) : null}

          {empty ? (
            <EmptyState
              icon={SearchX}
              title={t('search.emptyTitle')}
              description={t('search.emptyDesc', { query: query.trim() })}
            />
          ) : null}

          {hasQuery && !loading && !empty ? (
            <div className="space-y-10">
              <p className="text-[0.8125rem] text-muted-foreground">
                {t('search.resultCount', { count: results.total })}
              </p>

              {results.applications.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-[0.8125rem] font-medium tracking-wide text-muted-foreground uppercase">
                    {t('search.groupApplications')}
                    <span className="ml-2 tabular-nums font-normal normal-case">
                      {results.applications.length}
                    </span>
                  </h2>
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl ring-1 ring-border/70">
                    {results.applications.map(({ application: app }) => {
                      const Icon = PLATFORM_ICON[app.platform]
                      return (
                        <li key={app.id}>
                          <Link
                            to={`/applications/${app.id}`}
                            className={cn(
                              'flex items-center gap-3 bg-card/40 px-4 py-3.5',
                              'transition-colors duration-[var(--duration-hover)]',
                              'hover:bg-muted/40 dark:bg-card/25',
                            )}
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                              <LayoutGrid
                                className="size-4 text-muted-foreground"
                                strokeWidth={1.75}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-[0.875rem] font-medium text-foreground">
                                  {app.name}
                                </span>
                                <Icon
                                  className="size-3.5 shrink-0 text-muted-foreground/70"
                                  strokeWidth={1.75}
                                />
                              </span>
                              <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground">
                                {app.region.name}
                                {' · '}
                                {app.packageName}
                                {' · '}
                                {t('search.latestVersion', {
                                  version: app.latestVersion,
                                })}
                              </span>
                            </span>
                            <span className="hidden shrink-0 text-[0.75rem] text-muted-foreground sm:block">
                              {formatRelativeTime(app.updatedAt)}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {results.artifacts.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-[0.8125rem] font-medium tracking-wide text-muted-foreground uppercase">
                    {t('search.groupArtifacts')}
                    <span className="ml-2 tabular-nums font-normal normal-case">
                      {results.artifacts.length}
                    </span>
                  </h2>
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl ring-1 ring-border/70">
                    {results.artifacts.map(({ artifact, application }) => {
                      const Icon = PLATFORM_ICON[artifact.platform]
                      return (
                        <li key={artifact.id}>
                          <Link
                            to={`/applications/${application.id}`}
                            className={cn(
                              'flex items-center gap-3 bg-card/40 px-4 py-3.5',
                              'transition-colors duration-[var(--duration-hover)]',
                              'hover:bg-muted/40 dark:bg-card/25',
                            )}
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                              <FileBox
                                className="size-4 text-muted-foreground"
                                strokeWidth={1.75}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-[0.875rem] font-medium text-foreground">
                                  {application.name}
                                  {' · '}v{artifact.version}
                                </span>
                                <Icon
                                  className="size-3.5 shrink-0 text-muted-foreground/70"
                                  strokeWidth={1.75}
                                />
                              </span>
                              <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground">
                                {artifact.filename}
                                {' · '}
                                {artifact.uploader}
                              </span>
                            </span>
                            <span className="hidden shrink-0 text-[0.75rem] text-muted-foreground sm:block">
                              {formatRelativeTime(artifact.uploadedAt)}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </PageContainer>
    </AppLayout>
  )
}
