import { useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

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
import { useRegions } from '@/features/regions/use-regions'
import { useApplicationCatalog } from '@/features/applications/use-applications'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiCreateRegion, apiDeleteRegion, apiUpdateRegion } from '@/services/api'
import type { Region } from '@/types/application'
import { SettingsPanel } from './settings-panel'

type RegionDraft = {
  code: string
  name: string
  sortOrder: string
}

const EMPTY_DRAFT: RegionDraft = { code: '', name: '', sortOrder: '0' }

export function RegionsSettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { regions, loading, error } = useRegions()
  const { catalog } = useApplicationCatalog()
  const [editing, setEditing] = useState<Region | null>(null)
  const [draft, setDraft] = useState<RegionDraft>(EMPTY_DRAFT)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingRegion, setDeletingRegion] = useState<Region | null>(null)
  const [deleting, setDeleting] = useState(false)

  const boundApplications = deletingRegion
    ? catalog.filter((application) => application.region.id === deletingRegion.id)
    : []

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (region: Region) => {
    setEditing(region)
    setDraft({
      code: region.code,
      name: region.name,
      sortOrder: String(region.sortOrder),
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const save = async () => {
    const code = draft.code.trim()
    const name = draft.name.trim()
    const sortOrder = Number(draft.sortOrder)
    if (!code || !name || !Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError(t('settings.regionInvalid'))
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await apiUpdateRegion(editing.id, { code, name, sortOrder })
      } else {
        await apiCreateRegion({ code, name, sortOrder })
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.regions.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      setDialogOpen(false)
      toast.success(editing ? t('settings.regionUpdated') : t('settings.regionCreated'))
    } catch (caught) {
      setFormError(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.regionSaveFailed'),
        }),
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (region: Region) => {
    try {
      await apiUpdateRegion(region.id, { enabled: !region.enabled })
      await queryClient.invalidateQueries({ queryKey: queryKeys.regions.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      toast.success(
        region.enabled ? t('settings.regionDisabled') : t('settings.regionEnabled'),
      )
    } catch (caught) {
      toast.error(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.regionSaveFailed'),
        }),
      )
    }
  }

  const deleteRegion = async () => {
    if (!deletingRegion || boundApplications.length > 0) return

    setDeleting(true)
    try {
      await apiDeleteRegion(deletingRegion.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.regions.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      toast.success(t('settings.regionDeleted'))
      setDeletingRegion(null)
    } catch (caught) {
      toast.error(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.regionDeleteFailed'),
        }),
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <SettingsPanel
      title={t('settings.regionsTitle')}
      description={t('settings.regionsDesc')}
      wide
    >
      <div className="overflow-hidden rounded-xl bg-card/70 ring-1 ring-border/70">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 sm:px-5">
          <p className="text-[0.75rem] text-muted-foreground">
            {t('settings.regionCount', { count: regions.length })}
          </p>
          {isAdmin ? (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              {t('settings.addRegion')}
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-36 items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : error ? (
          <p className="px-5 py-10 text-center text-[0.8125rem] text-destructive">
            {t('settings.regionsLoadFailed')}
          </p>
        ) : regions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <MapPin className="mx-auto size-5 text-muted-foreground/60" />
            <p className="mt-3 text-[0.875rem] font-medium">{t('settings.noRegions')}</p>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              {t('settings.noRegionsHint')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {regions.map((region) => (
              <li
                key={region.id}
                className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5"
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/45 text-muted-foreground',
                    !region.enabled && 'opacity-50',
                  )}
                >
                  <MapPin className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[0.875rem] font-medium">
                      {region.name}
                    </span>
                    {!region.enabled ? (
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                        {t('settings.regionInactive')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                    {region.code} ·{' '}
                    {t('settings.regionSort', { value: region.sortOrder })}
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => openEdit(region)}
                      aria-label={t('settings.editRegion', { name: region.name })}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => void toggleEnabled(region)}
                      aria-label={
                        region.enabled
                          ? t('settings.disableRegion', { name: region.name })
                          : t('settings.enableRegion', { name: region.name })
                      }
                    >
                      <Power className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setDeletingRegion(region)}
                      aria-label={t('settings.deleteRegion', { name: region.name })}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isAdmin ? (
        <p className="mt-3 text-[0.75rem] text-muted-foreground">
          {t('settings.regionsAdminOnly')}
        </p>
      ) : null}

      <Modal open={dialogOpen} onOpenChange={setDialogOpen}>
        <ModalContent className="w-[min(30rem,calc(100vw-2rem))]">
          <ModalHeader>
            <ModalTitle>
              {editing ? t('settings.editRegionTitle') : t('settings.addRegionTitle')}
            </ModalTitle>
            <ModalDescription>{t('settings.regionDialogDesc')}</ModalDescription>
          </ModalHeader>
          <ModalBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[0.8125rem] font-medium">
                  {t('settings.regionName')}
                </span>
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="h-10"
                  maxLength={120}
                  autoFocus
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[0.8125rem] font-medium">
                  {t('settings.regionCode')}
                </span>
                <Input
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, code: event.target.value }))
                  }
                  className="h-10 font-mono"
                  maxLength={64}
                  placeholder="east_china"
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[0.8125rem] font-medium">
                  {t('settings.regionSortOrder')}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={9999}
                  value={draft.sortOrder}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                  className="h-10"
                />
              </label>
            </div>
            {formError ? (
              <p className="mt-4 text-[0.75rem] text-destructive">{formError}</p>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {saving ? t('settings.saving') : t('common.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        open={deletingRegion !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeletingRegion(null)
        }}
      >
        <ModalContent className="w-[min(32rem,calc(100vw-2rem))]">
          <ModalHeader>
            <ModalTitle>{t('settings.deleteRegionTitle')}</ModalTitle>
            <ModalDescription>
              {boundApplications.length > 0
                ? t('settings.regionDeleteBlockedDesc', {
                    name: deletingRegion?.name,
                    count: boundApplications.length,
                  })
                : t('settings.regionDeleteConfirmDesc', { name: deletingRegion?.name })}
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            {boundApplications.length > 0 ? (
              <div>
                <p className="text-[0.8125rem] font-medium text-foreground">
                  {t('settings.regionBoundApplications', {
                    count: boundApplications.length,
                  })}
                </p>
                <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg ring-1 ring-border/60">
                  {boundApplications.map((application) => (
                    <li key={application.id}>
                      <Link
                        to={`/applications/${application.id}?tab=settings`}
                        onClick={() => setDeletingRegion(null)}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-[0.8125rem] transition-colors hover:bg-muted/45"
                      >
                        <span className="truncate font-medium">{application.name}</span>
                        <span className="shrink-0 text-[0.75rem] text-primary">
                          {t('settings.unbindRegion')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletingRegion(null)}
              disabled={deleting}
            >
              {t('common.cancel')}
            </Button>
            {boundApplications.length === 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void deleteRegion()}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {deleting
                  ? t('settings.deletingRegion')
                  : t('settings.deleteRegionAction')}
              </Button>
            ) : null}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </SettingsPanel>
  )
}
