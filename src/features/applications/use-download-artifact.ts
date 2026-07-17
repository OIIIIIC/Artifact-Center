import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { formatFileSize } from '@/lib/format'

export type DownloadTarget = {
  /** Unique key for loading state (artifact id or "latest:appId") */
  id: string
  filename: string
  version?: string
  sizeBytes?: number
  /** Mock: force failure for demo */
  forceError?: boolean
}

/**
 * Mock download with calm feedback:
 * button loading → toast success / error.
 * No dedicated download page.
 */
export function useDownloadArtifact() {
  const { t } = useTranslation()
  const [busyId, setBusyId] = useState<string | null>(null)

  const download = useCallback(
    async (target: DownloadTarget) => {
      if (busyId) return

      setBusyId(target.id)
      const toastId = toast.loading(t('download.starting'), {
        description: [target.version ? `v${target.version}` : null, target.filename]
          .filter(Boolean)
          .join(' · '),
      })

      try {
        // Mock network + file prepare
        await new Promise((r) => setTimeout(r, 900 + Math.random() * 500))

        if (target.forceError) {
          throw new Error('mock-fail')
        }

        // Mock file blob download (tiny placeholder content)
        const body = [
          'Artifact Center — mock download',
          `file: ${target.filename}`,
          target.version ? `version: ${target.version}` : '',
          target.sizeBytes != null ? `size: ${formatFileSize(target.sizeBytes)}` : '',
          `at: ${new Date().toISOString()}`,
        ]
          .filter(Boolean)
          .join('\n')

        const blob = new Blob([body], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = target.filename
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
      } catch {
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

  return {
    download,
    busyId,
    isBusy: (id: string) => busyId === id,
  }
}
