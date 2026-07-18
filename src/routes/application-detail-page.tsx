import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivityPanel } from '@/features/applications/activity-panel'
import { ApplicationDetailHeader } from '@/features/applications/application-detail-header'
import { ArtifactRiskNotice } from '@/features/applications/artifact-risk-warning'
import { ApplicationDetailSkeleton } from '@/features/applications/application-detail-skeleton'
import { ApplicationSettingsPanel } from '@/features/applications/application-settings-panel'
import { ApplicationSummary } from '@/features/applications/application-summary'
import { ArtifactsTable } from '@/features/applications/artifacts-table'
import { OverviewRecentVersions } from '@/features/applications/overview-recent-versions'
import { ReleaseNotesPanel } from '@/features/applications/release-notes-panel'
import { useApplicationDetail } from '@/features/applications/use-application-detail'
import { ShareLinksPanel } from '@/features/share/share-links-panel'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

export function ApplicationDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const {
    loading,
    application,
    artifacts,
    releases,
    members,
    latest,
    recentVersions,
    notFound,
  } = useApplicationDetail(id)
  const canWrite =
    user?.role === 'admin' ||
    (user?.role === 'maintainer' &&
      members.some((member) => member.id === user.id && member.role === 'maintainer'))

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
    { value: 'activity', label: t('detail.tabActivity') },
    ...(canWrite
      ? ([
          { value: 'shares', label: t('detail.tabShares') },
          { value: 'settings', label: t('detail.tabSettings') },
        ] as const)
      : []),
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
          {application.status === 'archived' ? (
            <ArtifactRiskNotice risk="applicationArchived" context="application" />
          ) : null}
          <ApplicationDetailHeader application={application} latest={latest} />

          <ApplicationSummary
            application={application}
            latest={latest}
            artifactCount={artifacts.length}
          />

          <Tabs
            defaultValue={
              searchParams.get('tab') === 'settings' ? 'settings' : 'overview'
            }
            className="gap-6"
          >
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
                applicationName={application.name}
                applicationStatus={application.status}
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
              <ArtifactsTable
                artifacts={artifacts}
                applicationId={application.id}
                applicationName={application.name}
                applicationStatus={application.status}
              />
            </TabsContent>

            <TabsContent value="release-notes" className="mt-0 outline-none">
              <ReleaseNotesPanel
                releases={releases}
                applicationId={application.id}
                applicationStatus={application.status}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4 outline-none">
              <div>
                <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                  {t('detail.activityTitle')}
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {t('detail.activityHint')}
                </p>
              </div>
              <ActivityPanel applicationId={application.id} />
            </TabsContent>

            {canWrite ? (
              <TabsContent value="shares" className="mt-0 space-y-4 outline-none">
                <div>
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                    {t('detail.sharesTitle')}
                  </h2>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                    {t('detail.sharesHint')}
                  </p>
                </div>
                <ShareLinksPanel applicationId={application.id} />
              </TabsContent>
            ) : null}

            {canWrite ? (
              <TabsContent value="settings" className="mt-0 outline-none">
                <ApplicationSettingsPanel
                  key={application.id}
                  application={application}
                  autoOpenMembers={searchParams.get('addMember') === '1'}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
