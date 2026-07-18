import { useQueryClient } from '@tanstack/react-query'
import {
  Download,
  Loader2,
  MoreHorizontal,
  Package,
  Share2,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { ShareDialog } from '@/features/share/share-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArtifactReleaseBadges } from '@/features/applications/artifact-release-badges'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useDownloadArtifact } from '@/features/applications/use-download-artifact'
import { formatFileSize, formatRelativeTime } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { canWriteContent } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { apiDeleteArtifact, apiUpdateArtifact } from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import type { ApplicationStatus } from '@/types/application'
import { getArtifactRiskStatus, type Artifact } from '@/types/artifact'

interface ArtifactsTableProps {
  artifacts: Artifact[]
  /** When empty, upload CTA deep-links with this app id */
  applicationId?: string
  applicationName?: string
  applicationStatus?: ApplicationStatus
  className?: string
}

export function ArtifactsTable({
  artifacts,
  applicationId,
  applicationName,
  applicationStatus,
  className,
}: ArtifactsTableProps) {
  const { t, i18n } = useTranslation()
  void i18n.language
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const canWrite = canWriteContent(role)
  const applicationArchived = applicationStatus === 'archived'
  const canManage = canWrite && !applicationArchived
  const { download, isBusy, downloadConfirmation } = useDownloadArtifact()
  const [shareArt, setShareArt] = useState<Artifact | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const getMenuPosition = (trigger: HTMLElement) => {
    const triggerRect = trigger.getBoundingClientRect()
    const menuHeight = 160
    const gap = 4
    const openUpward =
      triggerRect.bottom + menuHeight + gap > window.innerHeight - 8 &&
      triggerRect.top > menuHeight + gap + 8
    const top = openUpward
      ? Math.max(8, triggerRect.top - menuHeight - gap)
      : Math.min(window.innerHeight - menuHeight - 8, triggerRect.bottom + gap)

    return {
      top,
      right: Math.max(8, window.innerWidth - triggerRect.right),
    }
  }

  const invalidate = async () => {
    if (!applicationId) return
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.artifacts.byApp(applicationId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.detail(applicationId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.audit.byApp(applicationId),
      }),
    ])
  }

  const onMarkLatest = async (art: Artifact) => {
    if (art.status === 'latest') return
    setBusyAction(`latest:${art.id}`)
    setMenuId(null)
    try {
      await apiUpdateArtifact(art.id, { markLatest: true })
      await invalidate()
      toast.success(t('detail.markLatestDone'), {
        description: `v${art.version}`,
      })
    } catch (err) {
      toast.error(
        getRequestErrorMessage(err, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('detail.artifactActionFailed'),
        }),
      )
    } finally {
      setBusyAction(null)
    }
  }

  const onDeprecate = async (art: Artifact) => {
    if (art.status === 'deprecated' || art.channel === 'deprecated') return
    setBusyAction(`dep:${art.id}`)
    setMenuId(null)
    try {
      await apiUpdateArtifact(art.id, {
        channel: 'deprecated',
        status: art.status === 'latest' ? 'deprecated' : 'deprecated',
      })
      await invalidate()
      toast.success(t('detail.deprecateDone'), {
        description: `v${art.version}`,
      })
    } catch (err) {
      toast.error(
        getRequestErrorMessage(err, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('detail.artifactActionFailed'),
        }),
      )
    } finally {
      setBusyAction(null)
    }
  }

  const onDelete = async (art: Artifact) => {
    setBusyAction(`del:${art.id}`)
    try {
      await apiDeleteArtifact(art.id)
      await invalidate()
      setConfirmDeleteId(null)
      setMenuId(null)
      toast.success(t('detail.deleteArtifactDone'), {
        description: `v${art.version}`,
      })
    } catch (err) {
      toast.error(
        getRequestErrorMessage(err, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('detail.artifactActionFailed'),
        }),
      )
    } finally {
      setBusyAction(null)
    }
  }

  if (artifacts.length === 0) {
    const uploadTo = applicationId ? `/upload?app=${applicationId}` : '/upload'
    return (
      <EmptyState
        icon={Package}
        title={t('detail.emptyArtifactsTitle')}
        description={t('detail.emptyArtifactsDesc')}
        className="py-14"
        action={
          canManage ? (
            <Button asChild size="lg">
              <Link to={uploadTo}>
                <Upload className="size-3.5" strokeWidth={1.75} />
                {t('detail.uploadArtifact')}
              </Link>
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl ring-1 ring-border/70 dark:ring-border',
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 hover:bg-transparent">
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              {t('detail.colVersion')}
            </TableHead>
            <TableHead className="hidden h-11 px-4 text-[0.75rem] font-medium text-muted-foreground sm:table-cell">
              {t('detail.colPlatform')}
            </TableHead>
            <TableHead className="hidden h-11 px-4 text-[0.75rem] font-medium text-muted-foreground lg:table-cell">
              {t('detail.colSize')}
            </TableHead>
            <TableHead className="hidden h-11 px-4 text-[0.75rem] font-medium text-muted-foreground md:table-cell">
              {t('detail.colUploadTime')}
            </TableHead>
            <TableHead className="hidden h-11 px-4 text-[0.75rem] font-medium text-muted-foreground xl:table-cell">
              {t('detail.colUploader')}
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              {t('detail.colStatus')}
            </TableHead>
            <TableHead className="h-11 w-[1%] px-4 text-right text-[0.75rem] font-medium text-muted-foreground">
              <span className="sr-only">{t('common.download')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {artifacts.map((art) => {
            const PlatformIcon = PLATFORM_ICON[art.platform]
            const busy = isBusy(art.id)
            const rowBusy = busyAction?.endsWith(art.id)
            const menuOpen = menuId === art.id
            const confirmDel = confirmDeleteId === art.id

            return (
              <TableRow
                key={art.id}
                className={cn(
                  'border-border/50 transition-colors duration-[var(--duration-hover)]',
                  'hover:bg-muted/35 dark:hover:bg-muted/25',
                )}
              >
                <TableCell className="px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.8125rem] font-medium text-foreground">
                      v{art.version}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-muted-foreground/75">
                      {t('detail.build', { number: art.buildNumber })}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground sm:hidden">
                      <PlatformIcon className="size-3 opacity-70" strokeWidth={1.75} />
                      <span>{t(`platform.${art.platform}`)}</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono">{formatFileSize(art.sizeBytes)}</span>
                    </p>
                  </div>
                </TableCell>
                <TableCell className="hidden px-4 py-3.5 sm:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                    <PlatformIcon className="size-3.5 opacity-70" strokeWidth={1.75} />
                    {t(`platform.${art.platform}`)}
                  </span>
                </TableCell>
                <TableCell className="hidden px-4 py-3.5 font-mono text-[0.8125rem] text-muted-foreground lg:table-cell">
                  {formatFileSize(art.sizeBytes)}
                </TableCell>
                <TableCell className="hidden px-4 py-3.5 text-[0.8125rem] text-muted-foreground md:table-cell">
                  <time dateTime={art.uploadedAt}>
                    {formatRelativeTime(art.uploadedAt)}
                  </time>
                </TableCell>
                <TableCell className="hidden px-4 py-3.5 text-[0.8125rem] text-foreground/90 xl:table-cell">
                  {art.uploader}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <ArtifactReleaseBadges artifact={art} />
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right">
                  <div className="relative inline-flex items-center justify-end gap-0.5">
                    {applicationId && applicationName ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`${t('share.action')} v${art.version}`}
                        onClick={() => setShareArt(art)}
                      >
                        <Share2 className="size-3.5" strokeWidth={1.75} />
                        <span className="hidden sm:inline">{t('share.action')}</span>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`${t('common.download')} ${art.filename}`}
                      onClick={() =>
                        void download({
                          id: art.id,
                          artifactId: art.id,
                          filename: art.filename,
                          version: art.version,
                          sizeBytes: art.sizeBytes,
                          riskStatus: applicationArchived
                            ? 'applicationArchived'
                            : getArtifactRiskStatus(art),
                        })
                      }
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                      ) : (
                        <Download className="size-3.5" strokeWidth={1.75} />
                      )}
                      <span className="hidden sm:inline">{t('common.download')}</span>
                    </Button>

                    {canManage ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          aria-label={t('detail.moreActions')}
                          aria-expanded={menuOpen}
                          disabled={Boolean(rowBusy)}
                          onClick={(event) => {
                            setConfirmDeleteId(null)
                            if (menuOpen) {
                              setMenuId(null)
                              return
                            }
                            setMenuPosition(getMenuPosition(event.currentTarget))
                            setMenuId(art.id)
                          }}
                        >
                          {rowBusy ? (
                            <Loader2
                              className="size-3.5 animate-spin"
                              strokeWidth={1.75}
                            />
                          ) : (
                            <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
                          )}
                        </Button>

                        {menuOpen
                          ? createPortal(
                              <div
                                className={cn(
                                  'fixed z-50 min-w-[11rem] rounded-xl bg-popover p-1 shadow-md ring-1 ring-border',
                                )}
                                style={{
                                  top: menuPosition.top,
                                  right: menuPosition.right,
                                }}
                                role="menu"
                              >
                                {confirmDel ? (
                                  <div className="space-y-2 p-2">
                                    <p className="text-[0.75rem] text-muted-foreground">
                                      {t('detail.deleteArtifactConfirm', {
                                        version: art.version,
                                      })}
                                    </p>
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 border-0 bg-muted/40 ring-1 ring-border/60"
                                        onClick={() => setConfirmDeleteId(null)}
                                      >
                                        {t('common.cancel')}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        className="h-8"
                                        onClick={() => void onDelete(art)}
                                      >
                                        {t('detail.confirmDeleteArtifact')}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      disabled={art.status === 'latest'}
                                      className={cn(
                                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.8125rem]',
                                        'text-foreground hover:bg-muted/50',
                                        'disabled:cursor-not-allowed disabled:opacity-40',
                                      )}
                                      onClick={() => void onMarkLatest(art)}
                                    >
                                      <Star
                                        className="size-3.5 opacity-70"
                                        strokeWidth={1.75}
                                      />
                                      {t('detail.markLatest')}
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      disabled={
                                        art.status === 'deprecated' ||
                                        art.channel === 'deprecated'
                                      }
                                      className={cn(
                                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.8125rem]',
                                        'text-foreground hover:bg-muted/50',
                                        'disabled:cursor-not-allowed disabled:opacity-40',
                                      )}
                                      onClick={() => void onDeprecate(art)}
                                    >
                                      <Package
                                        className="size-3.5 opacity-70"
                                        strokeWidth={1.75}
                                      />
                                      {t('detail.deprecateArtifact')}
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className={cn(
                                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.8125rem]',
                                        'text-destructive hover:bg-destructive/10',
                                      )}
                                      onClick={() => setConfirmDeleteId(art.id)}
                                    >
                                      <Trash2
                                        className="size-3.5 opacity-80"
                                        strokeWidth={1.75}
                                      />
                                      {t('detail.deleteArtifact')}
                                    </button>
                                  </>
                                )}
                              </div>,
                              document.body,
                            )
                          : null}
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {applicationId && applicationName && shareArt ? (
        <ShareDialog
          open
          onOpenChange={(open) => {
            if (!open) setShareArt(null)
          }}
          applicationId={applicationId}
          applicationName={applicationName}
          artifact={shareArt}
          applicationArchived={applicationArchived}
        />
      ) : null}
      {downloadConfirmation}
    </div>
  )
}
