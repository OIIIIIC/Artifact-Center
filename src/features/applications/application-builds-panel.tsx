import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Play, RefreshCw, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getJenkinsRequestErrorMessage } from '@/lib/jenkins-request-error'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import {
  apiBuildDownload,
  apiCancelBuild,
  apiGetBuild,
  apiListBuilds,
  buildKeys,
  type BuildFile,
  type BuildRun,
} from '@/services/api/builds'
import { apiGetApplicationBuildConfig, jenkinsKeys } from '@/services/api/jenkins'
import type { Application } from '@/types/application'
import { BuildLog } from './build-log'
import { PublishBuildDialog, StartBuildDialog } from './build-dialogs'

const activeStates = ['pending', 'submitting', 'queued', 'running']
export function ApplicationBuildsPanel({
  application,
  active,
}: {
  application: Application
  active: boolean
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [search, setSearch] = useSearchParams()
  const [before, setBefore] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [publishFile, setPublishFile] = useState<BuildFile | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const settings = useQuery({
    queryKey: jenkinsKeys.application(application.id),
    queryFn: () => apiGetApplicationBuildConfig(application.id),
    enabled: active,
  })
  const history = useQuery({
    queryKey: buildKeys.list(application.id, before),
    queryFn: () => apiListBuilds(application.id, before),
    enabled: active,
    refetchInterval: active ? 5000 : false,
  })
  const selected = search.get('build') || history.data?.items[0]?.id || ''
  const detail = useQuery({
    queryKey: buildKeys.detail(application.id, selected),
    queryFn: () => apiGetBuild(application.id, selected),
    enabled: active && Boolean(selected),
    refetchInterval: (query) =>
      active &&
      (activeStates.includes(query.state.data?.build.status ?? '') ||
        query.state.data?.build.status === 'unknown' ||
        query.state.data?.publications.some((p) =>
          ['pending', 'importing'].includes(p.status),
        ))
        ? 4000
        : false,
  })
  const run = detail.data?.build
  const published =
    detail.data?.publications
      .filter((p) => p.status === 'published')
      .map((p) => p.id)
      .join(',') ?? ''
  useEffect(() => {
    if (!published) return
    void client.invalidateQueries({ queryKey: queryKeys.applications.all })
    void client.invalidateQueries({ queryKey: queryKeys.artifacts.byApp(application.id) })
    void client.invalidateQueries({ queryKey: queryKeys.releases.byApp(application.id) })
    void client.invalidateQueries({ queryKey: queryKeys.audit.byApp(application.id) })
  }, [published, application.id, client])
  const choose = (id: string) => {
    setPublishFile(null)
    setSearch(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('build', id)
        return next
      },
      { replace: true },
    )
  }
  const refresh = () =>
    client.invalidateQueries({ queryKey: buildKeys.all(application.id) })
  const errorMessage = (caught: unknown) =>
    getJenkinsRequestErrorMessage(caught, {
      offline: t('common.requestFailedOffline'),
      unavailable: t('common.requestFailedUnavailable'),
      fallback: t('builds.operationFailed'),
    })
  async function cancelBuild(target: BuildRun) {
    setBusy('cancel')
    try {
      await apiCancelBuild(application.id, target.id)
      await refresh()
      toast.success(t('builds.cancelRequested'))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }
  async function download(file: BuildFile) {
    if (!run) return
    setBusy(file.relativePath)
    try {
      const url = await apiBuildDownload(application.id, run.id, file.relativePath)
      const link = document.createElement('a')
      link.href = url
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(t('download.started'))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }
  const ready = Boolean(settings.data?.connectionReady && settings.data.config?.enabled)
  const hasActive =
    history.data?.items.some((item) => activeStates.includes(item.status)) ?? false
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('builds.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('builds.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
            {t('builds.refresh')}
          </Button>
          <Button
            disabled={!ready || hasActive || application.status === 'archived'}
            onClick={() => setStarting(true)}
          >
            <Play className="size-4" />
            {t('builds.start')}
          </Button>
        </div>
      </div>
      {settings.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('jenkins.loadFailed')}{' '}
          <Button variant="ghost" onClick={() => void settings.refetch()}>
            {t('builds.refresh')}
          </Button>
        </p>
      ) : !settings.isPending && !ready ? (
        <p className="rounded-lg border border-border p-3 text-sm">
          {t('builds.configureFirst')}{' '}
          <Link className="underline" to={`/applications/${application.id}?tab=settings`}>
            {t('builds.openSettings')}
          </Link>
        </p>
      ) : null}
      {application.status === 'archived' && (
        <p className="text-sm text-muted-foreground">{t('builds.archived')}</p>
      )}
      {history.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('builds.historyFailed')}
        </p>
      )}
      {history.isPending ? (
        <p role="status">{t('jenkins.loading')}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="space-y-2" aria-label={t('builds.history')}>
              {history.data?.items.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">{t('builds.empty')}</p>
              )}
              {history.data?.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={selected === item.id}
                  onClick={() => choose(item.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left text-sm',
                    selected === item.id
                      ? 'border-primary/40 bg-muted/50'
                      : 'border-border hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {item.buildNumber !== null ? `#${item.buildNumber}` : item.jobPath}
                    </span>
                    <BuildStatus status={item.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()} · {item.requestedByName}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {before && (
                <Button size="sm" variant="outline" onClick={() => setBefore(null)}>
                  {t('builds.newest')}
                </Button>
              )}
              {history.data?.nextCursor && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBefore(history.data!.nextCursor)}
                >
                  {t('builds.older')}
                </Button>
              )}
            </div>
          </div>
          <div className="min-w-0 space-y-5">
            {detail.isError && (
              <p role="alert" className="text-sm text-destructive">
                {t('builds.detailFailed')}
              </p>
            )}
            {run && (
              <>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">
                      {run.jobPath}{' '}
                      {run.buildNumber !== null ? `#${run.buildNumber}` : ''}
                    </h3>
                    <BuildStatus status={run.status} />
                  </div>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {t('builds.commit')}:{' '}
                    {run.commits.join(', ') || t('builds.commitUnknown')}
                  </p>
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                    {run.parameters.map((p) => (
                      <div key={p.name}>
                        <dt className="text-muted-foreground">{p.name}</dt>
                        <dd className="max-w-xs whitespace-pre-wrap break-all">
                          {p.value || '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {run.error && (
                    <p
                      role="status"
                      className="mt-3 text-sm text-amber-700 dark:text-amber-300"
                    >
                      {run.error}
                    </p>
                  )}
                  {(activeStates.includes(run.status) || run.status === 'unknown') && (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(busy) || Boolean(run.cancelRequestedAt)}
                      onClick={() => void cancelBuild(run)}
                    >
                      <Square className="size-3" />
                      {run.cancelRequestedAt
                        ? t('builds.cancelling')
                        : t('builds.cancel')}
                    </Button>
                  )}
                </div>
                <BuildLog key={run.id} run={run} active={active} />
                {run.status === 'success' && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">{t('builds.artifacts')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t('builds.retentionHint')}
                    </p>
                    {run.files.length === 0 && (
                      <p className="rounded-lg border border-border p-4 text-sm">
                        {t('builds.noArtifacts')}
                      </p>
                    )}
                    {run.files.map((file) => {
                      const publication = detail.data?.publications.find(
                        (p) => p.relativePath === file.relativePath,
                      )
                      const publishing = publication && publication.status !== 'failed'
                      return (
                        <div
                          key={file.relativePath}
                          className="space-y-2 rounded-lg border border-border p-4"
                        >
                          <p className="break-all text-sm font-medium">{file.fileName}</p>
                          <p className="break-all text-xs text-muted-foreground">
                            {file.relativePath}
                          </p>
                          {file.targetName && (
                            <p className="text-sm">
                              {t('builds.publishTarget')}: {file.targetName}
                            </p>
                          )}
                          {file.targetError && (
                            <p role="alert" className="text-sm text-destructive">
                              {file.targetError}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(busy)}
                              onClick={() => void download(file)}
                            >
                              <Download className="size-3.5" />
                              {t('common.download')}
                            </Button>
                            <Button
                              size="sm"
                              disabled={
                                Boolean(publishing) ||
                                application.status === 'archived' ||
                                Boolean(file.targetError)
                              }
                              onClick={() => setPublishFile(file)}
                            >
                              {publication?.status === 'failed'
                                ? t('builds.retryPublish')
                                : t('builds.publish')}
                            </Button>
                            {publication?.status === 'published' &&
                              publication.artifactId && (
                                <Button asChild size="sm" variant="ghost">
                                  <Link
                                    to={`/applications/${publication.targetApplicationId ?? file.targetApplicationId ?? application.id}?tab=artifacts`}
                                  >
                                    {t('builds.viewArtifact')}
                                  </Link>
                                </Button>
                              )}
                          </div>
                          {publication && (
                            <p role="status" className="text-sm text-muted-foreground">
                              {t(`builds.publication.${publication.status}`)} ·{' '}
                              {publication.version} · {t(`builds.${publication.channel}`)}
                              {publication.status === 'published' &&
                              !publication.artifactId
                                ? ` · ${t('builds.artifactRemoved')}`
                                : ''}
                            </p>
                          )}
                          {publication?.error && (
                            <p role="alert" className="text-sm text-destructive">
                              {publication.error}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {starting && settings.data?.config && (
        <StartBuildDialog
          appId={application.id}
          config={settings.data.config}
          hasUnknown={
            history.data?.items.some((item) => item.status === 'unknown') ?? false
          }
          onClose={() => setStarting(false)}
          onStarted={(created) => {
            setStarting(false)
            setBefore(null)
            choose(created.id)
            void refresh()
            toast.success(t('builds.requestAccepted'))
          }}
        />
      )}
      {publishFile && run && (
        <PublishBuildDialog
          run={run}
          file={publishFile}
          previous={detail.data?.publications.find(
            (p) => p.relativePath === publishFile.relativePath,
          )}
          onClose={() => setPublishFile(null)}
          onPublished={() => {
            setPublishFile(null)
            void refresh()
            toast.success(t('builds.publishAccepted'))
          }}
        />
      )}
    </section>
  )
}

function BuildStatus({ status }: { status: BuildRun['status'] }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'shrink-0 rounded-md px-2 py-1 text-xs',
        status === 'success'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : ['failure', 'unstable', 'unknown'].includes(status)
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {t(`builds.status.${status}`)}
    </span>
  )
}
