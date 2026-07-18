import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Info, Loader2, Pencil, Trash2, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/common'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApplicationMembersPanel } from '@/features/applications/application-members-panel'
import { APPLICATION_STATUS_CHIP } from '@/features/applications/application-status-meta'
import {
  APPLICATION_FIELD_LIMITS,
  type ApplicationEditableField,
} from '@/lib/application-fields'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { canDeleteApplication } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { apiDeleteApplication, apiUpdateApplication } from '@/services/api'
import { ApiError } from '@/services/http'
import { useAuthStore } from '@/store/auth-store'
import type {
  Application,
  ApplicationPlatform,
  ApplicationStatus,
} from '@/types/application'

type SettingsView = 'basic' | 'members' | 'danger'
type EditableField = Exclude<ApplicationEditableField, 'owner'>

const PLATFORMS: ApplicationPlatform[] = ['android', 'windows', 'zip']
const STATUSES: ApplicationStatus[] = ['active', 'new', 'beta', 'deprecated', 'archived']

interface ApplicationSettingsPanelProps {
  application: Application
  autoOpenMembers?: boolean
}

export function ApplicationSettingsPanel({
  application,
  autoOpenMembers = false,
}: ApplicationSettingsPanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const platformRole = useAuthStore((state) => state.user?.role)
  const canDelete = canDeleteApplication(platformRole)

  const [view, setView] = useState<SettingsView>(autoOpenMembers ? 'members' : 'basic')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(application.name)
  const [description, setDescription] = useState(application.description)
  const [packageName, setPackageName] = useState(application.packageName)
  const [platform, setPlatform] = useState(application.platform)
  const [repository, setRepository] = useState(application.repository)
  const [status, setStatus] = useState<ApplicationStatus>(application.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditableField, string>>>(
    {},
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const infoDirty =
    name.trim() !== application.name ||
    description.trim() !== application.description ||
    packageName.trim() !== application.packageName ||
    platform !== application.platform ||
    repository.trim() !== application.repository
  const statusDirty = status !== application.status
  const dirty = infoDirty || statusDirty
  const deleteNameMatches = deleteConfirmName.trim() === application.name.trim()

  const resetDraft = () => {
    setName(application.name)
    setDescription(application.description)
    setPackageName(application.packageName)
    setPlatform(application.platform)
    setRepository(application.repository)
    setStatus(application.status)
    setError(null)
    setFieldErrors({})
  }

  const updateField = (
    field: EditableField,
    value: string,
    setter: (value: string) => void,
  ) => {
    setter(value)
    setError(null)
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const validate = () => {
    const errors: Partial<Record<EditableField, string>> = {}
    const required = [
      ['name', name, t('createApp.fieldName')],
      ['description', description, t('createApp.fieldDescription')],
      ['packageName', packageName, t('createApp.fieldPackage')],
    ] as const
    for (const [field, value, label] of required) {
      if (!value.trim()) errors[field] = t('appSettings.fieldRequired', { field: label })
    }
    const values: Record<EditableField, string> = {
      name,
      description,
      packageName,
      repository,
    }
    for (const field of Object.keys(values) as EditableField[]) {
      if (values[field].length > APPLICATION_FIELD_LIMITS[field]) {
        errors[field] = t('appSettings.fieldTooLong', {
          max: APPLICATION_FIELD_LIMITS[field],
        })
      }
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError(t('appSettings.errorInvalid'))
      return false
    }
    return true
  }

  const save = async () => {
    setError(null)
    if (!validate()) {
      setEditing(true)
      return
    }
    setSaving(true)
    try {
      const updated = await apiUpdateApplication(application.id, {
        name: name.trim(),
        description: description.trim(),
        packageName: packageName.trim(),
        platform,
        repository: repository.trim(),
        status,
      })
      queryClient.setQueryData(queryKeys.applications.detail(application.id), updated)
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      setEditing(false)
      toast.success(t('appSettings.saved'))
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'package_taken') {
        const message = t('appSettings.packageTaken')
        setFieldErrors((current) => ({ ...current, packageName: message }))
        setError(message)
      } else {
        setError(
          getRequestErrorMessage(caught, {
            offline: t('common.requestFailedOffline'),
            unavailable: t('common.requestFailedUnavailable'),
            fallback: t('appSettings.errorGeneric'),
          }),
        )
      }
    } finally {
      setSaving(false)
    }
  }

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

  const views: Array<{
    id: SettingsView
    label: string
    icon: typeof Info
    visible: boolean
  }> = [
    { id: 'basic', label: t('appSettings.navBasic'), icon: Info, visible: true },
    { id: 'members', label: t('appSettings.navMembers'), icon: Users, visible: true },
    {
      id: 'danger',
      label: t('appSettings.navDanger'),
      icon: AlertTriangle,
      visible: canDelete,
    },
  ]

  return (
    <div className="grid min-h-[28rem] gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8">
      <nav
        className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
        aria-label={t('appSettings.sectionNav')}
      >
        {views
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.8125rem] font-medium transition-colors',
                  view === item.id
                    ? 'bg-muted/70 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  item.id === 'danger' && view === item.id && 'text-destructive',
                )}
              >
                <Icon className="size-3.5 opacity-75" />
                {item.label}
              </button>
            )
          })}
      </nav>

      <div className="min-w-0">
        {view === 'basic' ? (
          <BasicSettings
            application={application}
            editing={editing}
            saving={saving}
            dirty={dirty}
            error={error}
            fieldErrors={fieldErrors}
            values={{ name, description, packageName, platform, repository, status }}
            onEdit={() => setEditing(true)}
            onCancel={() => {
              resetDraft()
              setEditing(false)
            }}
            onFieldChange={(field, value) => {
              const setters: Record<EditableField, (next: string) => void> = {
                name: setName,
                description: setDescription,
                packageName: setPackageName,
                repository: setRepository,
              }
              updateField(field, value, setters[field])
            }}
            onPlatformChange={setPlatform}
            onStatusChange={setStatus}
            onSave={() => void save()}
          />
        ) : null}

        {view === 'members' ? (
          <ApplicationMembersPanel
            applicationId={application.id}
            autoOpen={autoOpenMembers}
          />
        ) : null}

        {view === 'danger' && canDelete ? (
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
        ) : null}
      </div>
    </div>
  )
}

function BasicSettings({
  application,
  editing,
  saving,
  dirty,
  error,
  fieldErrors,
  values,
  onEdit,
  onCancel,
  onFieldChange,
  onPlatformChange,
  onStatusChange,
  onSave,
}: {
  application: Application
  editing: boolean
  saving: boolean
  dirty: boolean
  error: string | null
  fieldErrors: Partial<Record<EditableField, string>>
  values: {
    name: string
    description: string
    packageName: string
    platform: ApplicationPlatform
    repository: string
    status: ApplicationStatus
  }
  onEdit: () => void
  onCancel: () => void
  onFieldChange: (field: EditableField, value: string) => void
  onPlatformChange: (platform: ApplicationPlatform) => void
  onStatusChange: (status: ApplicationStatus) => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-foreground">
            {t('appSettings.navBasic')}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
            {t('appSettings.basicDescription')}
          </p>
        </div>
        {!editing ? (
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil />
            {t('appSettings.edit')}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={onCancel}
          >
            <X />
            {t('appSettings.cancelEdit')}
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="grid gap-x-8 gap-y-5 rounded-xl bg-muted/20 p-5 ring-1 ring-border/60 sm:grid-cols-2">
          <InfoCell label={t('createApp.fieldName')}>{application.name}</InfoCell>
          <InfoCell label={t('createApp.fieldPackage')} mono>
            {application.packageName}
          </InfoCell>
          <InfoCell label={t('createApp.fieldDescription')} className="sm:col-span-2">
            {application.description}
          </InfoCell>
          <InfoCell label={t('createApp.fieldPlatform')}>
            {t(`platform.${application.platform}`)}
          </InfoCell>
          <InfoCell label={t('createApp.fieldRepository')} mono>
            {application.repository || t('appSettings.emptyValue')}
          </InfoCell>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            field="name"
            label={t('createApp.fieldName')}
            value={values.name}
            error={fieldErrors.name}
            onChange={(value) => onFieldChange('name', value)}
          />
          <TextField
            field="packageName"
            label={t('createApp.fieldPackage')}
            value={values.packageName}
            error={fieldErrors.packageName}
            mono
            onChange={(value) => onFieldChange('packageName', value)}
          />
          <label className="space-y-1.5 sm:col-span-2">
            <FieldLabel
              label={t('createApp.fieldDescription')}
              value={values.description}
              max={APPLICATION_FIELD_LIMITS.description}
            />
            <textarea
              value={values.description}
              rows={4}
              maxLength={APPLICATION_FIELD_LIMITS.description}
              onChange={(event) => onFieldChange('description', event.target.value)}
              className={cn(
                'min-h-24 w-full resize-y rounded-lg bg-muted/30 px-3 py-2.5 text-[0.875rem] outline-none ring-1 ring-border/60 focus-visible:ring-[3px] focus-visible:ring-ring/30',
                fieldErrors.description && 'ring-destructive/50',
              )}
            />
            <FormError
              message={fieldErrors.description}
              className="[&_p]:text-[0.75rem]"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-[0.8125rem] font-medium text-foreground">
              {t('createApp.fieldPlatform')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((item) => (
                <Choice
                  key={item}
                  active={values.platform === item}
                  onClick={() => onPlatformChange(item)}
                >
                  {t(`platform.${item}`)}
                </Choice>
              ))}
            </div>
          </div>
          <TextField
            field="repository"
            label={t('createApp.fieldRepository')}
            value={values.repository}
            error={fieldErrors.repository}
            mono
            optional
            onChange={(value) => onFieldChange('repository', value)}
          />
        </div>
      )}

      <div className="border-t border-border/60 pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[0.8125rem] font-medium text-foreground">
              {t('appSettings.sectionStatus')}
            </h3>
            <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
              {t('appSettings.statusHint')}
            </p>
          </div>
          <StatusBadge status={APPLICATION_STATUS_CHIP[values.status].badge}>
            {t(`appSettings.status.${values.status}`)}
          </StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((item) => (
            <button
              key={item}
              type="button"
              disabled={saving}
              aria-pressed={values.status === item}
              onClick={() => onStatusChange(item)}
              className={cn(
                'rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors',
                values.status === item
                  ? APPLICATION_STATUS_CHIP[item].selected
                  : APPLICATION_STATUS_CHIP[item].idle,
              )}
            >
              {t(`appSettings.status.${item}`)}
            </button>
          ))}
        </div>
      </div>

      {error ? <FormError message={error} /> : null}
      {dirty ? (
        <div className="flex justify-end">
          <Button type="button" size="lg" disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? t('appSettings.saving') : t('appSettings.save')}
          </Button>
        </div>
      ) : null}
    </section>
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

function TextField({
  field,
  label,
  value,
  error,
  mono,
  optional,
  onChange,
}: {
  field: EditableField
  label: string
  value: string
  error?: string
  mono?: boolean
  optional?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1.5">
      <FieldLabel
        label={label}
        value={value}
        max={APPLICATION_FIELD_LIMITS[field]}
        optional={optional ? 'optional' : undefined}
      />
      <Input
        value={value}
        maxLength={APPLICATION_FIELD_LIMITS[field]}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          mono && 'font-mono text-[0.8125rem]',
          error && 'border-destructive',
        )}
        aria-invalid={Boolean(error) || undefined}
      />
      <FormError message={error} className="[&_p]:text-[0.75rem]" />
    </label>
  )
}

function FieldLabel({
  label,
  value,
  max,
  optional,
}: {
  label: string
  value: string
  max: number
  optional?: string
}) {
  const { t } = useTranslation()
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="text-[0.8125rem] font-medium text-foreground">
        {label}
        {optional ? (
          <span className="ml-1.5 font-normal text-muted-foreground">
            {t('createApp.optional')}
          </span>
        ) : null}
      </span>
      <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
        {value.length} / {max}
      </span>
    </span>
  )
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
        active
          ? 'bg-foreground text-background'
          : 'bg-muted/40 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function InfoCell({
  label,
  children,
  mono,
  className,
}: {
  label: string
  children: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <dt className="text-[0.6875rem] font-medium text-muted-foreground/75 uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 break-words text-[0.875rem] text-foreground',
          mono && 'font-mono text-[0.8125rem] text-muted-foreground',
        )}
      >
        {children}
      </dd>
    </div>
  )
}
