import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Files } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { CollectionPagination } from '@/components/common/collection-pagination'
import { Input } from '@/components/ui/input'
import { useCollectionPage } from '@/hooks/use-collection-page'
import { copyText } from '@/lib/clipboard'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiApplicationPage, apiCreateShareCollection } from '@/services/api'
import { shareUrlForToken } from '@/store/share-store'
import type { Project, Region } from '@/types/application'
import type { ShareMode } from '@/types/share'

type ExpiryOption = 0 | 1 | 7 | 30

interface ShareCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  region: Region
  project?: Project
}

/** 按当前产品或项目分页选择应用，创建同产品范围的分享清单。 */
export function ShareCollectionDialog({
  open,
  onOpenChange,
  region,
  project,
}: ShareCollectionDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const scopeName = project?.name ?? region.name
  const scope = { product: region.id, project: project?.id, shareable: '1' as const }
  const query = useCollectionPage({
    queryKey: ['applications', 'share-collection', scope],
    queryFn: (cursor, signal) =>
      apiApplicationPage({ ...scope, sort: 'updated', limit: 20, cursor }, signal),
    enabled: open,
  })
  const shareableApplications = query.data?.items ?? []
  const [title, setTitle] = useState(() =>
    t('share.collectionDefaultName', { region: scopeName }),
  )
  const [selected, setSelected] = useState<Record<string, ShareMode>>({})
  const [expiry, setExpiry] = useState<ExpiryOption>(7)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const selectedCount = Object.keys(selected).length
  const pagePending = query.isPlaceholderData || query.isFetching
  const pageSelected = shareableApplications.every(
    (application) => selected[application.id],
  )

  const toggleApplication = (applicationId: string) => {
    setSelected((current) => {
      if (current[applicationId]) {
        const next = { ...current }
        delete next[applicationId]
        return next
      }
      if (Object.keys(current).length >= 20) return current
      return { ...current, [applicationId]: 'artifact' }
    })
    setCopiedUrl(null)
  }

  const setMode = (applicationId: string, mode: ShareMode) => {
    setSelected((current) => ({ ...current, [applicationId]: mode }))
    setCopiedUrl(null)
  }

  const create = async () => {
    if (selectedCount === 0) {
      toast.error(t('share.collectionRequiresItems'))
      return
    }
    setBusy(true)
    try {
      const share = await apiCreateShareCollection({
        title: title.trim() || t('share.collectionDefaultName', { region: scopeName }),
        regionId: region.id,
        items: Object.entries(selected).map(([applicationId, mode]) => ({
          applicationId,
          mode,
        })),
        expiresInDays: expiry,
      })
      const url = shareUrlForToken(share.token)
      setCopiedUrl(url)
      await Promise.all(
        Object.keys(selected).map((applicationId) =>
          queryClient.invalidateQueries({ queryKey: ['shares', applicationId] }),
        ),
      )
      if (await copyText(url)) {
        toast.success(t('share.collectionCreated'))
      } else {
        toast.error(t('share.copyFailed'))
      }
    } catch (error) {
      toast.error(
        getRequestErrorMessage(error, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('share.createFailed'),
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  const copyAgain = async () => {
    if (!copiedUrl) return
    if (await copyText(copiedUrl)) {
      toast.success(t('share.copied'))
    } else {
      toast.error(t('share.copyFailed'))
    }
  }

  return (
    <div
      // A full-screen backdrop filter makes every form update expensive to present,
      // especially while the generated link and success toast appear together.
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="share-collection-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <div className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-5 shadow-lg ring-1 ring-border/70">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
            <Files className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <h2
              id="share-collection-title"
              className="text-[0.9375rem] font-semibold tracking-tight"
            >
              {t(project ? 'share.collectionProjectTitle' : 'share.collectionTitle')}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              {t('share.collectionDescription', { region: scopeName })}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[0.75rem] font-medium">
              {t('share.collectionName')}
            </span>
            <Input
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[0.75rem] font-medium">
                  {t('share.collectionSelectApps')}
                </p>
                <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                  {t('share.collectionSelectHint')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {t('share.collectionItemCount', { count: selectedCount })}
                </span>
                {shareableApplications.length > 0 ? (
                  <button
                    type="button"
                    disabled={
                      busy ||
                      pagePending ||
                      query.isError ||
                      selectedCount >= 20 ||
                      pageSelected
                    }
                    className="font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                    onClick={() => {
                      setSelected((current) => {
                        const next = { ...current }
                        for (const application of shareableApplications) {
                          if (Object.keys(next).length >= 20) break
                          next[application.id] ??= 'artifact'
                        }
                        return next
                      })
                      setCopiedUrl(null)
                    }}
                  >
                    {t(
                      query.hasPrevious || query.hasNext
                        ? 'share.collectionSelectPage'
                        : 'share.collectionSelectAll',
                    )}
                  </button>
                ) : null}
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                    onClick={() => {
                      setSelected({})
                      setCopiedUrl(null)
                    }}
                  >
                    {t('share.collectionClear')}
                  </button>
                ) : null}
              </div>
            </div>

            {query.isLoading ? (
              <p
                role="status"
                className="px-4 py-6 text-center text-sm text-muted-foreground"
              >
                {t('applications.loading')}
              </p>
            ) : query.isError ? (
              <div
                role="alert"
                className="space-y-2 px-4 py-6 text-center text-sm text-muted-foreground"
              >
                <p>{t('common.serviceUnavailableDescription')}</p>
                <Button variant="outline" onClick={() => void query.refetch()}>
                  {t('common.retry')}
                </Button>
              </div>
            ) : shareableApplications.length > 0 ? (
              <fieldset
                disabled={busy || pagePending}
                aria-busy={pagePending}
                className="max-h-72 min-w-0 divide-y divide-border/50 overflow-y-auto rounded-xl ring-1 ring-border/70"
              >
                {shareableApplications.map((application) => {
                  const mode = selected[application.id]
                  return (
                    <div
                      key={application.id}
                      className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={Boolean(mode)}
                        disabled={!mode && selectedCount >= 20}
                        onClick={() => toggleApplication(application.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border',
                            mode
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border-strong',
                          )}
                        >
                          {mode ? <Check className="size-3" strokeWidth={2} /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[0.8125rem] font-medium">
                            {application.name}
                          </span>
                          <span className="block text-[0.6875rem] text-muted-foreground">
                            v{application.latestVersion}
                          </span>
                        </span>
                      </button>
                      <div
                        className="flex shrink-0 gap-1"
                        aria-label={t('share.modeLabel')}
                      >
                        <ModeButton
                          active={mode === 'artifact'}
                          disabled={!mode}
                          onClick={() => setMode(application.id, 'artifact')}
                        >
                          {t('share.collectionFixedCurrent')}
                        </ModeButton>
                        <ModeButton
                          active={mode === 'latest'}
                          disabled={!mode}
                          onClick={() => setMode(application.id, 'latest')}
                        >
                          {t('share.collectionFollowLatest')}
                        </ModeButton>
                      </div>
                    </div>
                  )
                })}
              </fieldset>
            ) : (
              <p className="rounded-xl bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                {t('share.collectionNoArtifacts')}
              </p>
            )}
            <CollectionPagination
              page={query.page}
              total={query.data?.total ?? 0}
              hasPrevious={query.hasPrevious}
              hasNext={!query.isError && query.hasNext}
              busy={busy || query.isFetching}
              onPrevious={query.previous}
              onNext={query.next}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[0.75rem] font-medium">{t('share.expiryLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  [7, t('share.expiry7d')],
                  [1, t('share.expiry1d')],
                  [30, t('share.expiry30d')],
                  [0, t('share.expiryNever')],
                ] as const
              ).map(([days, label]) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setExpiry(days)}
                  aria-pressed={expiry === days}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
                    expiry === days
                      ? 'bg-foreground text-background'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {copiedUrl ? (
            <div className="space-y-2 rounded-xl bg-muted/30 p-3 ring-1 ring-border/50">
              <p className="break-all font-mono text-[0.75rem] text-muted-foreground">
                {copiedUrl}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyAgain()}
              >
                <Copy className="size-3.5" /> {t('share.copyAgain')}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('common.close')}
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={busy || selectedCount === 0}
            onClick={() => void create()}
          >
            <Copy className="size-3.5" />{' '}
            {busy ? t('share.creating') : t('share.collectionCreate')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-[0.6875rem] transition-colors disabled:opacity-40',
        active
          ? 'bg-muted text-foreground ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
