import { createElement, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { apiDownloadArtifact, apiDownloadShare } from '@/services/api'
import { ArtifactDownloadConfirmDialog } from '@/features/applications/artifact-risk-warning'
import type { ArtifactOperationRiskStatus } from '@/types/artifact'

export type DownloadTarget = {
  /** Unique key for loading state (artifact id or "latest:appId") */
  id: string
  /** Real artifact id for API (required when not using shareToken) */
  artifactId?: string
  filename: string
  version?: string
  sizeBytes?: number
  /** Server share token — preferred for /d/:token landing */
  shareToken?: string
  /** 弃用或归档制品需要用户再次确认。 */
  riskStatus?: ArtifactOperationRiskStatus | null
  /** Force failure for demo */
  forceError?: boolean
}

/**
 * Download artifact via API: button loading → toast success / error.
 * No dedicated download page.
 */
export function useDownloadArtifact() {
  const { t } = useTranslation()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingTarget, setPendingTarget] = useState<DownloadTarget | null>(null)

  const startDownload = useCallback(
    async (target: DownloadTarget) => {
      if (busyId) return

      const artifactId = target.artifactId ?? target.id
      if (!target.shareToken && (!artifactId || artifactId.startsWith('latest:'))) {
        toast.error(t('download.failed'), {
          description: t('download.failedHint'),
        })
        return
      }

      setBusyId(target.id)
      const toastId = toast.loading(t('download.starting'), {
        description: [target.version ? `v${target.version}` : null, target.filename]
          .filter(Boolean)
          .join(' · '),
      })

      try {
        if (target.forceError) {
          throw new Error('force-fail')
        }

        const { blob, filename: serverName } = target.shareToken
          ? await apiDownloadShare(target.shareToken)
          : await apiDownloadArtifact(artifactId)

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = serverName || target.filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)

        toast.success(t('download.started'), {
          id: toastId,
          description: [target.version ? `v${target.version}` : null, target.filename]
            .filter(Boolean)
            .join(' · '),
        })
      } catch (err) {
        void err
        toast.error(t('download.failed'), {
          id: toastId,
          description: t('download.failedHint'),
        })
      } finally {
        setBusyId(null)
      }
    },
    [busyId, t],
  )

  const download = useCallback(
    async (target: DownloadTarget) => {
      if (target.riskStatus) {
        setPendingTarget(target)
        return
      }
      await startDownload(target)
    },
    [startDownload],
  )

  const downloadConfirmation = pendingTarget?.riskStatus
    ? createElement(ArtifactDownloadConfirmDialog, {
        risk: pendingTarget.riskStatus,
        version: pendingTarget.version,
        onCancel: () => setPendingTarget(null),
        onConfirm: () => {
          const target = pendingTarget
          setPendingTarget(null)
          void startDownload({ ...target, riskStatus: null })
        },
      })
    : null

  return {
    download,
    busyId,
    isBusy: (id: string) => busyId === id,
    downloadConfirmation,
  }
}
