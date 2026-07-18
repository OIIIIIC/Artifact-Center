import { Archive, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ArtifactOperationRiskStatus } from '@/types/artifact'

export function ArtifactRiskNotice({
  risk,
  context,
  className,
  titleId,
}: {
  risk: ArtifactOperationRiskStatus
  context: 'application' | 'download' | 'share'
  className?: string
  titleId?: string
}) {
  const { t } = useTranslation()
  const Icon = risk === 'archived' ? Archive : TriangleAlert

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[0.8125rem] ring-1',
        risk === 'archived'
          ? 'bg-muted/45 text-foreground ring-border-strong/60'
          : 'bg-warning/10 text-warning-foreground ring-warning/25',
        className,
      )}
      role="status"
    >
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <div>
        <p id={titleId} className="font-medium">
          {t(`artifactRisk.${risk}Title`)}
        </p>
        <p className="mt-0.5 leading-relaxed opacity-80">
          {t(
            `artifactRisk.${risk}${context === 'share' ? 'Share' : context === 'application' ? 'Application' : 'Download'}Desc`,
          )}
        </p>
      </div>
    </div>
  )
}

export function ArtifactDownloadConfirmDialog({
  risk,
  version,
  onCancel,
  onConfirm,
}: {
  risk: ArtifactOperationRiskStatus
  version?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/20 p-4 backdrop-blur-[2px] sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="artifact-risk-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-lg ring-1 ring-border/70">
        <ArtifactRiskNotice
          risk={risk}
          context="download"
          titleId="artifact-risk-title"
        />
        {version ? (
          <p className="mt-3 text-[0.75rem] text-muted-foreground">
            {t('artifactRisk.versionLine', { version })}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t(`artifactRisk.${risk}Continue`)}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
