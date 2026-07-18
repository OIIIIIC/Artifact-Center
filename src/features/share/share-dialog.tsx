import { Check, Copy, Link2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ArtifactRiskNotice } from '@/features/applications/artifact-risk-warning'
import { cn } from '@/lib/utils'
import { ApiError } from '@/services/http'
import { apiCreateShare } from '@/services/api'
import { shareUrlForToken } from '@/store/share-store'
import { getArtifactRiskStatus, type Artifact } from '@/types/artifact'
import type { ShareMode } from '@/types/share'

type ExpiryOption = 0 | 1 | 7 | 30

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  applicationName: string
  /** When set, default mode can be this pinned artifact */
  artifact?: Artifact
  applicationArchived?: boolean
  className?: string
}

/**
 * Create a server-issued share download link and copy it.
 */
export function ShareDialog({
  open,
  onOpenChange,
  applicationId,
  applicationName,
  artifact,
  applicationArchived = false,
  className,
}: ShareDialogProps) {
  const { t } = useTranslation()
  const artifactRisk = artifact ? getArtifactRiskStatus(artifact) : null

  const [mode, setMode] = useState<ShareMode>(
    artifact && artifactRisk !== 'archived' ? 'artifact' : 'latest',
  )
  const [expiry, setExpiry] = useState<ExpiryOption>(7)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canPin = Boolean(artifact)
  const pinBlocked = artifactRisk === 'archived'
  const createBlocked = applicationArchived
  const selectedMode = pinBlocked ? 'latest' : mode

  const modeHint = useMemo(() => {
    if (selectedMode === 'latest') return t('share.modeLatestHint')
    return t('share.modeArtifactHint', { version: artifact?.version ?? '—' })
  }, [selectedMode, artifact?.version, t])

  if (!open) return null

  const onCreate = async () => {
    if (createBlocked || (selectedMode === 'artifact' && (!artifact || pinBlocked))) {
      return
    }
    setBusy(true)

    try {
      const share = await apiCreateShare(applicationId, {
        mode: selectedMode,
        artifactId: selectedMode === 'artifact' ? artifact!.id : undefined,
        expiresInDays: expiry === 0 ? 0 : expiry,
      })
      const url = shareUrlForToken(share.token)
      try {
        await navigator.clipboard.writeText(url)
        setCopiedUrl(url)
        toast.success(t('share.copied'), { description: applicationName })
      } catch {
        setCopiedUrl(url)
        toast.error(t('share.copyFailed'))
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('share.createFailed'))
    } finally {
      setBusy(false)
    }
  }

  const onCopyAgain = async () => {
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
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center sm:items-center',
        'bg-foreground/20 p-4 backdrop-blur-[2px]',
        className,
      )}
      role="dialog"
      aria-modal
      aria-labelledby="share-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        className={cn(
          'w-full max-w-md rounded-2xl bg-background p-5 shadow-lg',
          'ring-1 ring-border/70 dark:ring-border',
          'animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
            <Link2 className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="share-dialog-title"
              className="text-[0.9375rem] font-semibold tracking-tight text-foreground"
            >
              {t('share.title')}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              {t('share.description', { name: applicationName })}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[0.75rem] font-medium text-foreground">
              {t('share.modeLabel')}
            </p>
            <div
              className="flex flex-col gap-1.5"
              role="radiogroup"
              aria-label={t('share.modeLabel')}
            >
              <ModeOption
                active={selectedMode === 'latest'}
                onClick={() => setMode('latest')}
                title={t('share.modeLatest')}
                desc={t('share.modeLatestHint')}
              />
              {canPin ? (
                <ModeOption
                  active={selectedMode === 'artifact'}
                  onClick={() => setMode('artifact')}
                  disabled={pinBlocked}
                  title={t('share.modeArtifact', {
                    version: artifact!.version,
                  })}
                  desc={
                    artifactRisk === 'archived'
                      ? t('share.archivedPinDisabled')
                      : t('share.modeArtifactHint', {
                          version: artifact!.version,
                        })
                  }
                />
              ) : null}
            </div>
            <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
              {modeHint}
            </p>
          </div>

          {createBlocked ? (
            <ArtifactRiskNotice risk="applicationArchived" context="share" />
          ) : artifactRisk === 'archived' ||
            (artifactRisk === 'deprecated' && selectedMode === 'artifact') ? (
            <ArtifactRiskNotice risk={artifactRisk} context="share" />
          ) : null}

          <div className="space-y-1.5">
            <p className="text-[0.75rem] font-medium text-foreground">
              {t('share.expiryLabel')}
            </p>
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
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
                    'transition-colors duration-[var(--duration-hover)]',
                    expiry === days
                      ? 'bg-foreground text-background'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                  )}
                  aria-pressed={expiry === days}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {copiedUrl ? (
            <div className="space-y-2 rounded-xl bg-muted/30 p-3 ring-1 ring-border/50">
              <p className="text-[0.75rem] font-medium text-foreground">
                {t('share.linkReady')}
              </p>
              <p className="break-all font-mono text-[0.75rem] text-muted-foreground">
                {copiedUrl}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-0 bg-background ring-1 ring-border/60"
                onClick={() => void onCopyAgain()}
              >
                <Copy className="size-3.5 opacity-70" strokeWidth={1.75} />
                {t('share.copyAgain')}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="border-0 bg-muted/40 ring-1 ring-border/60"
            onClick={() => onOpenChange(false)}
          >
            {t('common.close')}
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={
              busy ||
              createBlocked ||
              (selectedMode === 'artifact' && (!artifact || pinBlocked))
            }
            onClick={() => void onCreate()}
          >
            {busy ? (
              t('share.creating')
            ) : (
              <>
                {copiedUrl ? (
                  <Check className="size-3.5" strokeWidth={1.75} />
                ) : (
                  <Copy className="size-3.5" strokeWidth={1.75} />
                )}
                {copiedUrl ? t('share.createAnother') : t('share.createAndCopy')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ModeOption({
  active,
  onClick,
  disabled = false,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-xl px-3 py-2.5 text-left transition-colors duration-[var(--duration-hover)]',
        active
          ? 'bg-muted/50 ring-1 ring-border-strong/70'
          : 'hover:bg-muted/35 ring-1 ring-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
      )}
    >
      <span className="block text-[0.8125rem] font-medium text-foreground">{title}</span>
      <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">{desc}</span>
    </button>
  )
}
