import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Files } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiCreateShareCollection } from '@/services/api'
import { shareUrlForToken } from '@/store/share-store'
import type { Application, Region } from '@/types/application'
import type { ShareMode } from '@/types/share'

type ExpiryOption = 0 | 1 | 7 | 30

interface ShareCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  region: Region
  applications: Application[]
}

/** 创建同一地区内多个应用的分享清单。 */
export function ShareCollectionDialog({
  open,
  onOpenChange,
  region,
  applications,
}: ShareCollectionDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const shareableApplications = useMemo(
    () =>
      applications
        .filter(
          (application) =>
            application.status !== 'archived' && application.artifactCount > 0,
        )
        .slice(0, 20),
    [applications],
  )
  const [title, setTitle] = useState(() =>
    t('share.collectionDefaultName', { region: region.name }),
  )
  const [selected, setSelected] = useState<Record<string, ShareMode>>({})
  const [expiry, setExpiry] = useState<ExpiryOption>(7)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const selectedCount = Object.keys(selected).length

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
        title: title.trim() || t('share.collectionDefaultName', { region: region.name }),
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
      try {
        await navigator.clipboard.writeText(url)
        toast.success(t('share.collectionCreated'))
      } catch {
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
    try {
      await navigator.clipboard.writeText(copiedUrl)
      toast.success(t('share.copied'))
    } catch {
      toast.error(t('share.copyFailed'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 p-4 backdrop-blur-[2px] sm:items-center"
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
              {t('share.collectionTitle')}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              {t('share.collectionDescription', { region: region.name })}
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
                    className="font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelected(
                        selectedCount === shareableApplications.length
                          ? {}
                          : Object.fromEntries(
                              shareableApplications.map((application) => [
                                application.id,
                                'artifact',
                              ]),
                            ),
                      )
                      setCopiedUrl(null)
                    }}
                  >
                    {selectedCount === shareableApplications.length
                      ? t('share.collectionClear')
                      : t('share.collectionSelectAll')}
                  </button>
                ) : null}
              </div>
            </div>

            {shareableApplications.length > 0 ? (
              <div className="max-h-72 divide-y divide-border/50 overflow-y-auto rounded-xl ring-1 ring-border/70">
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
              </div>
            ) : (
              <p className="rounded-xl bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                {t('share.collectionNoArtifacts')}
              </p>
            )}
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
