import { useQueryClient } from '@tanstack/react-query'
import { Folder, Loader2, Box, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

export function RegionsSettingsPanel({
  isAdmin,
  hideHeader = false,
}: {
  isAdmin: boolean
  hideHeader?: boolean
}) {
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
  const [statusRegion, setStatusRegion] = useState<Region | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)

  const boundApplications = deletingRegion
    ? catalog.filter((application) => application.region.id === deletingRegion.id)
    : []
  const applicationCountByRegion = catalog.reduce<Record<string, number>>(
    (counts, application) => {
      counts[application.region.id] = (counts[application.region.id] ?? 0) + 1
      return counts
    },
    {},
  )
  const statusRegionApplicationCount = statusRegion
    ? (applicationCountByRegion[statusRegion.id] ?? 0)
    : 0

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
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects })
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

  const updateEnabled = async () => {
    if (!statusRegion) return

    setChangingStatus(true)
    try {
      await apiUpdateRegion(statusRegion.id, { enabled: !statusRegion.enabled })
      await queryClient.invalidateQueries({ queryKey: queryKeys.regions.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects })
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      toast.success(
        statusRegion.enabled ? t('settings.regionDisabled') : t('settings.regionEnabled'),
      )
      setStatusRegion(null)
    } catch (caught) {
      toast.error(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('settings.regionSaveFailed'),
        }),
      )
    } finally {
      setChangingStatus(false)
    }
  }

  const deleteRegion = async () => {
    if (!deletingRegion || boundApplications.length > 0) return

    setDeleting(true)
    try {
      await apiDeleteRegion(deletingRegion.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.regions.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects })
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
    <>
      <SettingsPanel
        title={t('settings.regionsTitle')}
        description={t('settings.regionsDesc')}
        wide
        hideHeader={hideHeader}
        className={hideHeader ? 'lg:h-full' : undefined}
      >
        <div className="flex min-h-[34rem] flex-col overflow-hidden rounded-2xl bg-card/70 ring-1 ring-border/70 lg:h-full lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-4 py-3 sm:px-5">
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
            <div className="flex min-h-36 flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : error ? (
            <p className="flex flex-1 items-center justify-center px-5 py-10 text-center text-[0.8125rem] text-destructive">
              {t('settings.regionsLoadFailed')}
            </p>
          ) : regions.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
              <Box className="mx-auto size-5 text-muted-foreground/60" />
              <p className="mt-3 text-[0.875rem] font-medium">
                {t('settings.noRegions')}
              </p>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                {t('settings.noRegionsHint')}
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_30%,transparent)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-content hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/45">
              <Table
                className="min-w-[44rem] table-fixed"
                containerClassName="overflow-visible"
              >
                <colgroup>
                  <col />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-24" />
                  {isAdmin ? <col className="w-56" /> : null}
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-11 px-5 text-[0.75rem] text-muted-foreground">
                      {t('settings.regionTableRegion')}
                    </TableHead>
                    <TableHead className="h-11 px-4 text-center text-[0.75rem] text-muted-foreground">
                      {t('settings.regionTableCode')}
                    </TableHead>
                    <TableHead className="h-11 px-4 text-center text-[0.75rem] text-muted-foreground">
                      {t('settings.regionTableApplications')}
                    </TableHead>
                    <TableHead className="h-11 px-4 text-center text-[0.75rem] text-muted-foreground">
                      {t('settings.regionTableStatus')}
                    </TableHead>
                    {isAdmin ? (
                      <TableHead className="h-11 px-5 text-center text-[0.75rem] text-muted-foreground">
                        {t('settings.regionTableActions')}
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regions.map((region) => {
                    const applicationCount = applicationCountByRegion[region.id] ?? 0
                    return (
                      <TableRow
                        key={region.id}
                        className={!region.enabled ? 'opacity-65' : undefined}
                      >
                        <TableCell className="px-5 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/45 text-muted-foreground',
                                !region.enabled && 'opacity-70',
                              )}
                            >
                              <Box className="size-4" strokeWidth={1.75} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[0.875rem] font-medium text-foreground">
                                {region.name}
                              </p>
                              {isAdmin ? (
                                <Link
                                  to={`/products?product=${region.id}`}
                                  className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-ring"
                                >
                                  <Folder className="size-3" />
                                  {t('directory.manageProjects')}
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-center">
                          <code className="rounded bg-muted/55 px-2 py-1 font-mono text-[0.75rem] text-muted-foreground">
                            {region.code}
                          </code>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-center">
                          <span
                            className={cn(
                              'text-[0.8125rem] tabular-nums',
                              applicationCount === 0
                                ? 'text-muted-foreground'
                                : 'font-medium text-foreground',
                            )}
                          >
                            {t('settings.regionApplicationCount', {
                              count: applicationCount,
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-center">
                          <span
                            className={cn(
                              'inline-flex rounded-md px-2 py-1 text-[0.6875rem] font-medium',
                              region.enabled
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {region.enabled
                              ? t('settings.regionActive')
                              : t('settings.regionInactive')}
                          </span>
                        </TableCell>
                        {isAdmin ? (
                          <TableCell className="px-5 py-3.5 text-center">
                            <div className="grid w-[10.75rem] grid-cols-[minmax(0,1fr)_1.75rem_1.75rem_1.75rem] items-center gap-1 mx-auto">
                              {region.enabled ? (
                                <Button
                                  asChild
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="justify-self-end"
                                >
                                  <Link to={`/applications/new?product=${region.id}`}>
                                    {t('settings.createApplicationInRegion')}
                                  </Link>
                                </Button>
                              ) : (
                                <span aria-hidden />
                              )}
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => openEdit(region)}
                                aria-label={t('settings.editRegion', {
                                  name: region.name,
                                })}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setStatusRegion(region)}
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
                                aria-label={t('settings.deleteRegion', {
                                  name: region.name,
                                })}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {!isAdmin ? (
          <p className="mt-3 text-[0.75rem] text-muted-foreground">
            {t('settings.regionsAdminOnly')}
          </p>
        ) : null}

        <Modal open={dialogOpen} onOpenChange={setDialogOpen}>
          <ModalContent className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl">
            <ModalHeader className="px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Box className="size-5" />
                </div>
                <div className="min-w-0">
                  <ModalTitle>
                    {editing
                      ? t('settings.editRegionTitle')
                      : t('settings.addRegionTitle')}
                  </ModalTitle>
                  <ModalDescription className="mt-0.5">
                    {t('settings.regionDialogDesc')}
                  </ModalDescription>
                </div>
              </div>
            </ModalHeader>
            <ModalBody className="p-6">
              <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/25 p-4">
                <label className="block space-y-1.5">
                  <span className="text-[0.75rem] font-medium tracking-wide text-muted-foreground">
                    {t('settings.regionName')}
                  </span>
                  <Input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    className="h-11 rounded-xl border-border/80 bg-background px-3.5 text-[0.9375rem] shadow-sm"
                    maxLength={120}
                    autoFocus
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <label className="block space-y-1.5">
                    <span className="text-[0.75rem] font-medium tracking-wide text-muted-foreground">
                      {t('settings.regionCode')}
                    </span>
                    <Input
                      value={draft.code}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, code: event.target.value }))
                      }
                      className="h-10 rounded-xl border-border/80 bg-background px-3 font-mono text-[0.8125rem] shadow-sm"
                      maxLength={64}
                      placeholder="east_china"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="flex items-center justify-between gap-2 text-[0.75rem] font-medium tracking-wide text-muted-foreground">
                      {t('settings.regionSortOrder')}
                      <span className="font-normal normal-case tracking-normal text-[0.6875rem]">
                        {t('settings.regionSortOrderShortHint')}
                      </span>
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
                      className="h-10 rounded-xl border-border/80 bg-background px-3 text-[0.875rem] tabular-nums shadow-sm"
                    />
                  </label>
                </div>
              </div>
              {formError ? (
                <p className="mt-3 text-[0.75rem] text-destructive">{formError}</p>
              ) : null}
            </ModalBody>
            <ModalFooter className="bg-muted/20 px-6 py-3.5">
              <Button
                type="button"
                variant="outline"
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
          open={statusRegion !== null}
          onOpenChange={(open) => {
            if (!open && !changingStatus) setStatusRegion(null)
          }}
        >
          <ModalContent className="w-[min(32rem,calc(100vw-2rem))]">
            <ModalHeader>
              <ModalTitle>
                {statusRegion?.enabled
                  ? t('settings.disableRegionTitle')
                  : t('settings.enableRegionTitle')}
              </ModalTitle>
              <ModalDescription>
                {statusRegion?.enabled
                  ? t('settings.disableRegionDesc', { name: statusRegion.name })
                  : t('settings.enableRegionDesc', { name: statusRegion?.name })}
              </ModalDescription>
            </ModalHeader>
            <ModalBody>
              {statusRegion?.enabled ? (
                <div className="space-y-3 rounded-xl bg-amber-500/10 p-4 ring-1 ring-amber-500/15">
                  <p className="text-[0.8125rem] font-medium text-foreground">
                    {t('settings.disableRegionImpactTitle')}
                  </p>
                  <ul className="space-y-2 text-[0.75rem] leading-relaxed text-muted-foreground">
                    <li>{t('settings.disableRegionImpactNew')}</li>
                    <li>
                      {t('settings.disableRegionImpactExisting', {
                        count: statusRegionApplicationCount,
                      })}
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-[0.8125rem] leading-relaxed text-foreground ring-1 ring-emerald-500/15">
                  {t('settings.enableRegionImpact')}
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                disabled={changingStatus}
                onClick={() => setStatusRegion(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant={statusRegion?.enabled ? 'destructive' : 'default'}
                disabled={changingStatus}
                onClick={() => void updateEnabled()}
              >
                {changingStatus ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {changingStatus
                  ? t('settings.changingRegionStatus')
                  : statusRegion?.enabled
                    ? t('settings.confirmDisableRegion')
                    : t('settings.confirmEnableRegion')}
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
    </>
  )
}
