import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import { formatFileSize } from '@/lib/format'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import {
  apiGetRetention,
  apiRunRetentionCleanup,
  apiUpdateRetention,
} from '@/services/api'
import { SettingsPanel } from './settings-panel'

const FIELD_CLASS = cn(
  'h-10 w-full rounded-lg bg-muted/30 px-3 text-[0.875rem] outline-none',
  'ring-1 ring-border/60 transition-[box-shadow,background-color] duration-[var(--duration-hover)]',
  'placeholder:text-muted-foreground/60',
  'focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30',
)

export function RetentionSettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['settings', 'retention'],
    queryFn: apiGetRetention,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const retention = query.data
  const [maxVersions, setMaxVersions] = useState('20')
  const [archiveDays, setArchiveDays] = useState('90')
  const [saving, setSaving] = useState(false)
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!retention || hydrated.current) return
    setMaxVersions(String(retention.maxVersions))
    setArchiveDays(String(retention.archiveDeprecatedDays))
    hydrated.current = true
  }, [retention])

  const storagePct = useMemo(() => {
    if (!retention?.diskTotalBytes || retention.diskUsedBytes == null) return 0
    return Math.min(
      100,
      Math.round((retention.diskUsedBytes / retention.diskTotalBytes) * 100),
    )
  }, [retention])

  const policyDirty = Boolean(
    retention &&
    (maxVersions !== String(retention.maxVersions) ||
      archiveDays !== String(retention.archiveDeprecatedDays)),
  )

  const refresh = async () => {
    hydrated.current = false
    await queryClient.invalidateQueries({ queryKey: ['settings', 'retention'] })
  }

  const save = async () => {
    const max = Number.parseInt(maxVersions, 10)
    const days = Number.parseInt(archiveDays, 10)
    if (
      !Number.isFinite(max) ||
      max < 1 ||
      max > 999 ||
      !Number.isFinite(days) ||
      days < 1 ||
      days > 3650
    ) {
      toast.error(t('settings.retentionInvalid'))
      return
    }
    setSaving(true)
    try {
      await apiUpdateRetention({ maxVersions: max, archiveDeprecatedDays: days })
      await refresh()
      toast.success(t('settings.retentionSaved'))
    } catch (error) {
      toast.error(
        getRequestErrorMessage(error, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.retentionSaveFailed'),
        }),
      )
    } finally {
      setSaving(false)
    }
  }

  const cleanup = async () => {
    setCleanupRunning(true)
    try {
      const { report } = await apiRunRetentionCleanup()
      await refresh()
      toast.success(t('settings.cleanupDone'), {
        description: t('settings.cleanupDoneDesc', {
          deleted: report.deletedVersions,
          archived: report.archivedDeprecated,
        }),
      })
      setCleanupDialogOpen(false)
    } catch (error) {
      toast.error(
        getRequestErrorMessage(error, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.cleanupFailed'),
        }),
      )
    } finally {
      setCleanupRunning(false)
    }
  }

  return (
    <SettingsPanel
      title={t('settings.retentionTitle')}
      description={t('settings.retentionDesc')}
    >
      {query.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
          <span className="text-[0.8125rem]">{t('common.loading')}</span>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3 rounded-2xl bg-card/60 p-5 ring-1 ring-border/70 dark:bg-card/40">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.storageUsage')}
              </span>
              <span className="text-[0.75rem] tabular-nums text-muted-foreground">
                {retention?.diskUsedBytes != null && retention.diskTotalBytes != null
                  ? `${formatFileSize(retention.diskUsedBytes)} / ${formatFileSize(retention.diskTotalBytes)} (${storagePct}%)`
                  : t('settings.diskSpaceUnavailable')}
              </span>
            </div>
            {retention?.diskTotalBytes != null ? (
              <div
                className="h-2 overflow-hidden rounded-full bg-muted/60"
                role="progressbar"
                aria-valuenow={storagePct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('settings.storageUsage')}
              >
                <div
                  className="h-full rounded-full bg-foreground/80 transition-[width] duration-300"
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            ) : null}
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/25 px-3 py-2.5">
                <dt className="text-[0.6875rem] text-muted-foreground">
                  {t('settings.diskAvailable')}
                </dt>
                <dd className="mt-0.5 text-[0.875rem] font-medium tabular-nums text-foreground">
                  {retention?.diskFreeBytes != null
                    ? formatFileSize(retention.diskFreeBytes)
                    : '—'}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/25 px-3 py-2.5">
                <dt className="text-[0.6875rem] text-muted-foreground">
                  {t('settings.artifactStorage')}
                </dt>
                <dd className="mt-0.5 text-[0.875rem] font-medium tabular-nums text-foreground">
                  {formatFileSize(retention?.artifactStorageBytes ?? 0)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.maxVersions')}
              </span>
              <Input
                type="number"
                min={1}
                max={999}
                value={maxVersions}
                onChange={(event) => setMaxVersions(event.target.value)}
                disabled={!isAdmin || saving}
                className={FIELD_CLASS}
              />
              <span className="block text-[0.75rem] text-muted-foreground">
                {t('settings.maxVersionsHint')}
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.archiveDays')}
              </span>
              <Input
                type="number"
                min={1}
                max={3650}
                value={archiveDays}
                onChange={(event) => setArchiveDays(event.target.value)}
                disabled={!isAdmin || saving}
                className={FIELD_CLASS}
              />
              <span className="block text-[0.75rem] text-muted-foreground">
                {t('settings.archiveDaysHint')}
              </span>
            </label>
          </div>
          {!isAdmin ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              {t('settings.retentionAdminOnly')}
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="mr-auto min-w-0">
                <Button
                  type="button"
                  size="lg"
                  variant="destructive"
                  disabled={cleanupRunning || saving || policyDirty}
                  onClick={() => setCleanupDialogOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  {t('settings.runCleanup')}
                </Button>
                {policyDirty ? (
                  <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
                    {t('settings.cleanupSaveFirst')}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="lg"
                className="min-w-[6.5rem]"
                disabled={saving || cleanupRunning}
                onClick={() => void save()}
              >
                {saving ? t('settings.saving') : t('settings.saveRetention')}
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={cleanupDialogOpen}
        onOpenChange={(open) => {
          if (!cleanupRunning) setCleanupDialogOpen(open)
        }}
      >
        <ModalContent className="w-[min(34rem,calc(100vw-2rem))]">
          <ModalHeader>
            <ModalTitle>{t('settings.cleanupConfirmTitle')}</ModalTitle>
            <ModalDescription>{t('settings.cleanupConfirmDesc')}</ModalDescription>
          </ModalHeader>
          <ModalBody>
            <div className="flex gap-3 rounded-xl bg-destructive/[0.06] p-4 ring-1 ring-destructive/20">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                strokeWidth={1.8}
              />
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium text-foreground">
                  {t('settings.cleanupIrreversibleTitle')}
                </p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-muted-foreground">
                  {t('settings.cleanupIrreversibleDesc')}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-lg bg-muted/30 px-3.5 py-3">
                <p className="text-[0.8125rem] font-medium text-foreground">
                  {t('settings.cleanupDeleteRuleTitle')}
                </p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-muted-foreground">
                  {t('settings.cleanupDeleteRuleDesc', {
                    count: retention?.maxVersions ?? maxVersions,
                  })}
                </p>
              </div>
              <div className="rounded-lg bg-muted/30 px-3.5 py-3">
                <p className="text-[0.8125rem] font-medium text-foreground">
                  {t('settings.cleanupArchiveRuleTitle')}
                </p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-muted-foreground">
                  {t('settings.cleanupArchiveRuleDesc', {
                    days: retention?.archiveDeprecatedDays ?? archiveDays,
                  })}
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={cleanupRunning}
              onClick={() => setCleanupDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cleanupRunning}
              onClick={() => void cleanup()}
            >
              {cleanupRunning ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {cleanupRunning
                ? t('settings.cleanupRunning')
                : t('settings.cleanupConfirmAction')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </SettingsPanel>
  )
}
