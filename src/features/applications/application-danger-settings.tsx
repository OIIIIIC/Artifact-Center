import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { apiDeleteApplication } from '@/services/api'
import type { Application } from '@/types/application'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function ApplicationDangerSettings({ application }: { application: Application }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const deleteNameMatches = deleteConfirmName.trim() === application.name.trim()
  const deleteApplication = async () => {
    if (!deleteNameMatches) return
    setDeleting(true)
    try {
      await apiDeleteApplication(application.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      toast.success(t('appSettings.deleted'), { description: application.name })
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(
        getRequestErrorMessage(err, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('appSettings.errorGeneric'),
        }),
      )
      setDeleting(false)
    }
  }
  return (
    <DangerSettings
      application={application}
      confirmDelete={confirmDelete}
      deleteConfirmName={deleteConfirmName}
      deleting={deleting}
      nameMatches={deleteNameMatches}
      onStart={() => setConfirmDelete(true)}
      onCancel={() => {
        setConfirmDelete(false)
        setDeleteConfirmName('')
      }}
      onNameChange={setDeleteConfirmName}
      onDelete={() => void deleteApplication()}
    />
  )
}

function DangerSettings({
  application,
  confirmDelete,
  deleteConfirmName,
  deleting,
  nameMatches,
  onStart,
  onCancel,
  onNameChange,
  onDelete,
}: {
  application: Application
  confirmDelete: boolean
  deleteConfirmName: string
  deleting: boolean
  nameMatches: boolean
  onStart: () => void
  onCancel: () => void
  onNameChange: (value: string) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-[0.9375rem] font-semibold text-destructive">
          {t('appSettings.dangerTitle')}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {t('appSettings.dangerDesc')}
        </p>
      </div>
      <div className="rounded-xl border border-destructive/35 bg-destructive/[0.025] p-5">
        {!confirmDelete ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.875rem] font-medium text-foreground">
                {t('appSettings.deleteTitle')}
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                {t('appSettings.deleteDesc')}
              </p>
            </div>
            <Button type="button" variant="destructive" onClick={onStart}>
              <Trash2 />
              {t('appSettings.deleteAction')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.8125rem] text-muted-foreground">
                {t('appSettings.deleteConfirmLead', { name: application.name })}
              </p>
              <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[0.75rem] font-medium">
                {t('appSettings.deleteConfirmLabel')}
              </span>
              <Input
                value={deleteConfirmName}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder={t('appSettings.deleteConfirmPlaceholder')}
                autoFocus
              />
            </label>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || !nameMatches}
                onClick={onDelete}
              >
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {deleting ? t('appSettings.deleting') : t('appSettings.confirmDelete')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
