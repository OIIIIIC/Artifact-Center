import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CollectionPagination } from '@/components/common/collection-pagination'
import { Button } from '@/components/ui/button'
import { ApplicationSearch } from './application-search'
import { ArtifactsTable } from './artifacts-table'
import { ReleaseNotesPanel } from './release-notes-panel'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useCollectionPage } from '@/hooks/use-collection-page'
import { apiArtifactPage, apiReleasePage } from '@/services/api'
import { queryKeys } from '@/lib/query-keys'
import type { Application } from '@/types/application'

export function ApplicationHistoryPage({
  application,
  canManage,
  kind,
}: {
  application: Application
  canManage: boolean
  kind: 'artifacts' | 'releases'
}) {
  // Separate child components keep each page's data and cursor types independent.
  return kind === 'artifacts' ? (
    <ArtifactHistory application={application} canManage={canManage} />
  ) : (
    <ReleaseHistory application={application} canManage={canManage} />
  )
}

function ArtifactHistory({
  application,
  canManage,
}: {
  application: Application
  canManage: boolean
}) {
  const { t } = useTranslation()
  const [draft, setQuery] = useState('')
  const q = useDebouncedValue(draft)
  const anchor = useRef<HTMLDivElement>(null)
  const page = useCollectionPage({
    queryKey: [...queryKeys.artifacts.byApp(application.id), 'page', q],
    cacheKey: `artifacts:${application.id}`,
    queryFn: (cursor, signal) =>
      apiArtifactPage(application.id, { q, cursor, limit: 30 }, signal),
  })
  return (
    <div ref={anchor} className="space-y-4 scroll-mt-4">
      <ApplicationSearch
        value={draft}
        onChange={setQuery}
        placeholder={t('pagination.searchArtifacts')}
      />
      {page.isLoading ? (
        <p role="status">{t('detail.loading')}</p>
      ) : page.isError ? (
        <Button onClick={() => void page.refetch()}>{t('common.retry')}</Button>
      ) : q && !page.data?.items.length ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {t('applications.noMatchTitle')}{' '}
          <Button variant="ghost" onClick={() => setQuery('')}>
            {t('common.clearFilters')}
          </Button>
        </div>
      ) : (
        <div aria-busy={page.isFetching}>
          <ArtifactsTable
            artifacts={page.data?.items ?? []}
            applicationId={application.id}
            applicationName={application.name}
            applicationStatus={application.status}
            canManage={canManage}
          />
        </div>
      )}
      <CollectionPagination
        page={page.page}
        total={page.data?.total ?? 0}
        hasNext={page.hasNext}
        hasPrevious={page.hasPrevious}
        busy={page.isFetching}
        onNext={() => {
          page.next()
          anchor.current?.scrollIntoView({ block: 'start' })
        }}
        onPrevious={() => {
          page.previous()
          anchor.current?.scrollIntoView({ block: 'start' })
        }}
      />
    </div>
  )
}

function ReleaseHistory({
  application,
  canManage,
}: {
  application: Application
  canManage: boolean
}) {
  const { t } = useTranslation()
  const [draft, setQuery] = useState('')
  const q = useDebouncedValue(draft)
  const anchor = useRef<HTMLDivElement>(null)
  const page = useCollectionPage({
    queryKey: [...queryKeys.releases.byApp(application.id), 'page', q],
    cacheKey: `releases:${application.id}`,
    queryFn: (cursor, signal) =>
      apiReleasePage(application.id, { q, cursor, limit: 20 }, signal),
  })
  return (
    <div ref={anchor} className="space-y-4 scroll-mt-4">
      <ApplicationSearch
        value={draft}
        onChange={setQuery}
        placeholder={t('pagination.searchReleases')}
      />
      {page.isLoading ? (
        <p role="status">{t('detail.loading')}</p>
      ) : page.isError ? (
        <Button onClick={() => void page.refetch()}>{t('common.retry')}</Button>
      ) : q && !page.data?.items.length ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {t('applications.noMatchTitle')}{' '}
          <Button variant="ghost" onClick={() => setQuery('')}>
            {t('common.clearFilters')}
          </Button>
        </div>
      ) : (
        <div aria-busy={page.isFetching}>
          <ReleaseNotesPanel
            releases={page.data?.items ?? []}
            applicationId={application.id}
            applicationStatus={application.status}
            canManage={canManage}
          />
        </div>
      )}
      <CollectionPagination
        page={page.page}
        total={page.data?.total ?? 0}
        hasNext={page.hasNext}
        hasPrevious={page.hasPrevious}
        busy={page.isFetching}
        onNext={() => {
          page.next()
          anchor.current?.scrollIntoView({ block: 'start' })
        }}
        onPrevious={() => {
          page.previous()
          anchor.current?.scrollIntoView({ block: 'start' })
        }}
      />
    </div>
  )
}
