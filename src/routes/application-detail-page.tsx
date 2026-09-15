import { motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import { DetailTabContent } from '@/features/applications/detail-tab-content'
import { resolveDetailTab } from '@/features/applications/detail-navigation'
import { Inbox, RefreshCw, ServerCrash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivityPanel } from '@/features/applications/activity-panel'
import { ApplicationDetailHeader } from '@/features/applications/application-detail-header'
import { ArtifactRiskNotice } from '@/features/applications/artifact-risk-warning'
import { ApplicationDetailSkeleton } from '@/features/applications/application-detail-skeleton'
import { ApplicationSettingsPanel } from '@/features/applications/application-settings-panel'
import { ApplicationSummary } from '@/features/applications/application-summary'
import { ApplicationHistoryPage } from '@/features/applications/application-history-page'
import { OverviewRecentVersions } from '@/features/applications/overview-recent-versions'
import { useApplicationDetail } from '@/features/applications/use-application-detail'
import { ShareLinksPanel } from '@/features/share/share-links-panel'
import { canMaintainApplication } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { ApplicationDirectory } from '@/features/products/application-directory'

export function ApplicationDetailPage() {
  const { t } = useTranslation()
  const motionId = useId()
  const reducedMotion = useReducedMotion()
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const { loading, application, latest, recentVersions, notFound, loadError, refetch } =
    useApplicationDetail(id)
  const canWrite = canMaintainApplication(user?.role, application?.accessRole)
  const requestedTab = searchParams.get('tab') ?? 'overview'
  const activeTab = resolveDetailTab(requestedTab, canWrite)
  const sidebarDirectory = (
    <ApplicationDirectory
      application={application}
      applicationId={id}
      tab={loading ? requestedTab : activeTab}
    />
  )

  if (loading) {
    return (
      <AppLayout
        contentClassName="scrollbar-subtle"
        sidebarDirectory={sidebarDirectory}
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

  if (loadError || (!application && !notFound)) {
    return (
      <AppLayout
        contentClassName="scrollbar-subtle"
        sidebarDirectory={sidebarDirectory}
        breadcrumbs={[
          { label: t('detail.breadcrumbApps'), href: '/' },
          { label: t('common.serviceUnavailableTitle') },
        ]}
      >
        <PageContainer rhythm="product">
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
        </PageContainer>
      </AppLayout>
    )
  }

  if (notFound || !application) {
    return (
      <AppLayout
        contentClassName="scrollbar-subtle"
        sidebarDirectory={sidebarDirectory}
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
      count: application.artifactCount,
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
      contentClassName="scrollbar-subtle"
      sidebarDirectory={sidebarDirectory}
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
          <ApplicationDetailHeader
            application={application}
            latest={latest}
            canManage={canWrite}
          />

          <ApplicationSummary
            application={application}
            latest={latest}
            artifactCount={application.artifactCount}
          />

          <Tabs
            value={activeTab}
            onValueChange={(tab) =>
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current)
                  if (tab === 'overview') next.delete('tab')
                  else next.set('tab', tab)
                  next.delete('addMember')
                  return next
                },
                { replace: true },
              )
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
                    'after:hidden',
                  )}
                >
                  {activeTab === tab.value ? (
                    <motion.span
                      layoutId={`${motionId}-underline`}
                      initial={false}
                      transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-foreground"
                    />
                  ) : null}
                  {tab.label}
                  {'count' in tab && tab.count != null ? (
                    <span className="ml-1.5 text-muted-foreground tabular-nums">
                      {tab.count}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <DetailTabContent
              key={`${application.id}-overview`}
              active={activeTab === 'overview'}
              value="overview"
              className="mt-0 space-y-4 outline-none"
            >
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
                canManage={canWrite}
              />
            </DetailTabContent>

            <DetailTabContent
              key={`${application.id}-artifacts`}
              active={activeTab === 'artifacts'}
              value="artifacts"
              className="mt-0 space-y-4 outline-none"
            >
              <div>
                <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                  {t('detail.artifactsTitle')}
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {t('detail.artifactsHint')}
                </p>
              </div>
              <ApplicationHistoryPage
                key={application.id}
                kind="artifacts"
                application={application}
                canManage={canWrite}
              />
            </DetailTabContent>

            <DetailTabContent
              key={`${application.id}-release-notes`}
              active={activeTab === 'release-notes'}
              value="release-notes"
              className="mt-0 outline-none"
            >
              <ApplicationHistoryPage
                key={application.id}
                kind="releases"
                application={application}
                canManage={canWrite}
              />
            </DetailTabContent>

            <DetailTabContent
              key={`${application.id}-activity`}
              active={activeTab === 'activity'}
              value="activity"
              className="mt-0 space-y-4 outline-none"
            >
              <div>
                <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                  {t('detail.activityTitle')}
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {t('detail.activityHint')}
                </p>
              </div>
              <ActivityPanel applicationId={application.id} />
            </DetailTabContent>

            {canWrite ? (
              <DetailTabContent
                key={`${application.id}-shares`}
                active={activeTab === 'shares'}
                value="shares"
                className="mt-0 space-y-4 outline-none"
              >
                <div>
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                    {t('detail.sharesTitle')}
                  </h2>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                    {t('detail.sharesHint')}
                  </p>
                </div>
                <ShareLinksPanel applicationId={application.id} />
              </DetailTabContent>
            ) : null}

            {canWrite ? (
              <DetailTabContent
                key={`${application.id}-settings`}
                active={activeTab === 'settings'}
                value="settings"
                className="mt-0 outline-none"
              >
                <ApplicationSettingsPanel
                  key={application.id}
                  application={application}
                  autoOpenMembers={searchParams.get('addMember') === '1'}
                />
              </DetailTabContent>
            ) : null}
          </Tabs>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
