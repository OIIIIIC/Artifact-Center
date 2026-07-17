import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApplicationDetailHeader } from '@/features/applications/application-detail-header'
import { ApplicationDetailSkeleton } from '@/features/applications/application-detail-skeleton'
import { ApplicationSettingsPanel } from '@/features/applications/application-settings-panel'
import { ApplicationSummary } from '@/features/applications/application-summary'
import { ArtifactsTable } from '@/features/applications/artifacts-table'
import { OverviewRecentVersions } from '@/features/applications/overview-recent-versions'
import { ReleaseNotesPanel } from '@/features/applications/release-notes-panel'
import { useApplicationDetail } from '@/features/applications/use-application-detail'
import { cn } from '@/lib/utils'

export function ApplicationDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { loading, application, artifacts, latest, recentVersions, notFound } =
    useApplicationDetail(id)

  if (loading) {
    return (
      <AppLayout
        breadcrumbs={[{ label: t('detail.breadcrumbApps'), href: '/' }, { label: '…' }]}
      >
        <PageContainer rhythm="product">
          <div aria-busy="true" aria-live="polite">
            <p className="sr-only">{t('detail.loading')}</p>
            <ApplicationDetailSkeleton />
          </div>
        </PageContainer>
      </AppLayout>
    )
  }

  if (notFound || !application) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: t('detail.breadcrumbApps'), href: '/' },
          { label: t('detail.notFound') },
        ]}
      >
        <PageContainer rhythm="product">
          <EmptyState
            icon={Inbox}
            title={t('detail.notFoundTitle')}
            description={t('detail.notFoundDescription')}
            action={
              <Button asChild size="lg">
                <Link to="/">{t('detail.backToApps')}</Link>
              </Button>
            }
          />
        </PageContainer>
      </AppLayout>
    )
  }

  const tabs = [
    { value: 'overview', label: t('detail.tabOverview') },
    {
      value: 'artifacts',
      label: t('detail.tabArtifacts'),
      count: artifacts.length,
    },
    { value: 'release-notes', label: t('detail.tabReleaseNotes') },
    { value: 'settings', label: t('detail.tabSettings') },
  ] as const

  return (
    <AppLayout
      breadcrumbs={[
        { label: t('detail.breadcrumbApps'), href: '/' },
        { label: application.name },
      ]}
    >
      <PageContainer rhythm="product">
        <div className="space-y-8 sm:space-y-10">
          <ApplicationDetailHeader application={application} latest={latest} />

          <ApplicationSummary
            application={application}
            latest={latest}
            artifactCount={artifacts.length}
          />

          <Tabs defaultValue="overview" className="gap-6">
            <TabsList
              variant="line"
              className={cn(
                'h-auto min-h-0 w-full justify-start gap-0 overflow-visible rounded-none',
                'border-b border-border/70 bg-transparent p-0 dark:border-border',
              )}
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'h-auto min-h-10 flex-none rounded-none px-3.5 pt-2.5 pb-2.5 text-[0.8125rem]',
                    'data-active:bg-transparent dark:data-active:bg-transparent',
                    'after:bottom-0 after:h-0.5',
                  )}
                >
                  {tab.label}
                  {'count' in tab && tab.count != null ? (
                    <span className="ml-1.5 text-muted-foreground tabular-nums">
                      {tab.count}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-4 outline-none">
              <div>
                <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                  {t('detail.recentVersions')}
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {t('detail.recentVersionsHint')}
                </p>
              </div>
              <OverviewRecentVersions
                artifacts={recentVersions}
                applicationId={application.id}
              />
            </TabsContent>

            <TabsContent value="artifacts" className="mt-0 space-y-4 outline-none">
              <div>
                <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                  {t('detail.artifactsTitle')}
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {t('detail.artifactsHint')}
                </p>
              </div>
              <ArtifactsTable artifacts={artifacts} applicationId={application.id} />
            </TabsContent>

            <TabsContent value="release-notes" className="mt-0 outline-none">
              <ReleaseNotesPanel artifacts={artifacts} applicationId={application.id} />
            </TabsContent>

            <TabsContent value="settings" className="mt-0 outline-none">
              <ApplicationSettingsPanel key={application.id} application={application} />
            </TabsContent>
          </Tabs>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
