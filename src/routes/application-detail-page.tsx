import { Link, useParams } from 'react-router-dom'
import { FileText, Inbox, Settings2 } from 'lucide-react'

import { EmptyState } from '@/components/feedback'
import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApplicationDetailHeader } from '@/features/applications/application-detail-header'
import { ApplicationDetailSkeleton } from '@/features/applications/application-detail-skeleton'
import { ApplicationSummary } from '@/features/applications/application-summary'
import { ArtifactsTable } from '@/features/applications/artifacts-table'
import { OverviewRecentVersions } from '@/features/applications/overview-recent-versions'
import { useApplicationDetail } from '@/features/applications/use-application-detail'
import { cn } from '@/lib/utils'

/**
 * Application Detail — object-first (GitHub / Vercel / Linear style).
 * Mock only. No edit/delete/dashboard.
 */
export function ApplicationDetailPage() {
  const { id } = useParams()
  const { loading, application, artifacts, latest, recentVersions, notFound } =
    useApplicationDetail(id)

  if (loading) {
    return (
      <AppLayout
        breadcrumbs={[{ label: 'Applications', href: '/' }, { label: '…' }]}
        showSearch={false}
      >
        <PageContainer className="pb-24 pt-8 sm:pt-10">
          <div aria-busy="true" aria-live="polite">
            <p className="sr-only">Loading application</p>
            <ApplicationDetailSkeleton />
          </div>
        </PageContainer>
      </AppLayout>
    )
  }

  if (notFound || !application) {
    return (
      <AppLayout
        breadcrumbs={[{ label: 'Applications', href: '/' }, { label: 'Not found' }]}
        showSearch={false}
      >
        <PageContainer className="pb-24 pt-10">
          <EmptyState
            icon={Inbox}
            title="Application not found"
            description="该应用不存在，或 Mock 数据中没有对应 id。"
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/">Back to Applications</Link>
              </Button>
            }
          />
        </PageContainer>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Applications', href: '/' }, { label: application.name }]}
      showSearch={false}
    >
      <PageContainer className="pb-24 pt-8 sm:pt-10">
        <div className="space-y-8 sm:space-y-10">
          <ApplicationDetailHeader application={application} />

          <ApplicationSummary
            application={application}
            latest={latest}
            artifactCount={artifacts.length}
          />

          <Tabs defaultValue="overview" className="gap-6">
            <TabsList
              variant="line"
              className={cn(
                'h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border/70 bg-transparent p-0',
                'dark:border-border',
              )}
            >
              <TabsTrigger
                value="overview"
                className="rounded-none px-3 pb-2.5 text-[0.8125rem] data-active:bg-transparent dark:data-active:bg-transparent"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="artifacts"
                className="rounded-none px-3 pb-2.5 text-[0.8125rem] data-active:bg-transparent dark:data-active:bg-transparent"
              >
                Artifacts
                <span className="ml-1.5 text-muted-foreground tabular-nums">
                  {artifacts.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="release-notes"
                className="rounded-none px-3 pb-2.5 text-[0.8125rem] data-active:bg-transparent dark:data-active:bg-transparent"
              >
                Release Notes
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="rounded-none px-3 pb-2.5 text-[0.8125rem] data-active:bg-transparent dark:data-active:bg-transparent"
              >
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-4 outline-none">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                    Recent versions
                  </h2>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                    最近三个构建，便于快速核对与下载。
                  </p>
                </div>
              </div>
              <OverviewRecentVersions artifacts={recentVersions} />
            </TabsContent>

            <TabsContent value="artifacts" className="mt-0 space-y-4 outline-none">
              <div>
                <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                  Artifacts
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  全部构建产物。按版本扫描，按需下载。
                </p>
              </div>
              <ArtifactsTable artifacts={artifacts} />
            </TabsContent>

            <TabsContent value="release-notes" className="mt-0 outline-none">
              <EmptyState
                icon={FileText}
                title="Release Notes"
                description="发布说明能力即将接入。当前请在 Overview 中查看各版本摘要。"
                className="py-16"
              />
            </TabsContent>

            <TabsContent value="settings" className="mt-0 outline-none">
              <EmptyState
                icon={Settings2}
                title="Settings"
                description="应用设置、权限与保留策略将在后续版本提供。"
                className="py-16"
              />
            </TabsContent>
          </Tabs>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
