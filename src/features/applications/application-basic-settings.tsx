import { StatusBadge } from '@/components/common'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { APPLICATION_STATUS_CHIP } from '@/features/applications/application-status-meta'
import { ProjectSelect } from '@/features/products/project-select'
import { useProjects } from '@/features/products/use-projects'
import { useRegions } from '@/features/regions/use-regions'
import { isApplicationCode, sanitizeApplicationCodeInput } from '@/lib/application-code'
import {
  APPLICATION_FIELD_LIMITS,
  type ApplicationEditableField,
} from '@/lib/application-fields'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiUpdateApplication } from '@/services/api'
import type {
  Application,
  ApplicationPlatform,
  ApplicationStatus,
  Region,
} from '@/types/application'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Choice, FieldLabel, InfoCell, TextField } from './application-settings-fields'

type EditableField = Exclude<ApplicationEditableField, 'owner'>
const PLATFORMS: ApplicationPlatform[] = ['android', 'windows', 'zip']
const STATUSES: ApplicationStatus[] = ['active', 'new', 'beta', 'deprecated', 'archived']
export function ApplicationBasicSettings({ application }: { application: Application }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { regions } = useRegions()
  const { projects } = useProjects()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(application.name)
  const [applicationCode, setApplicationCode] = useState(application.applicationCode)
  const [description, setDescription] = useState(application.description)
  const [packageName, setPackageName] = useState(application.packageName)
  const [platform, setPlatform] = useState(application.platform)
  const [regionId, setRegionId] = useState(application.region.id)
  const [projectId, setProjectId] = useState(application.projectId ?? '')
  const selectedProjectId =
    projectId || projects.find((p) => p.productId === regionId && p.isDefault)?.id || ''
  const [repository, setRepository] = useState(application.repository)
  const [status, setStatus] = useState<ApplicationStatus>(application.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditableField, string>>>(
    {},
  )
  const infoDirty =
    name.trim() !== application.name ||
    applicationCode.trim() !== application.applicationCode ||
    description.trim() !== application.description ||
    packageName.trim() !== application.packageName ||
    platform !== application.platform ||
    regionId !== application.region.id ||
    projectId !== (application.projectId ?? '') ||
    repository.trim() !== application.repository
  const statusDirty = status !== application.status
  const dirty = infoDirty || statusDirty
  const resetDraft = () => {
    setName(application.name)
    setApplicationCode(application.applicationCode)
    setDescription(application.description)
    setPackageName(application.packageName)
    setPlatform(application.platform)
    setRegionId(application.region.id)
    setProjectId(application.projectId ?? '')
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
      ['applicationCode', applicationCode, t('createApp.fieldApplicationCode')],
      ['description', description, t('createApp.fieldDescription')],
      ['packageName', packageName, t('createApp.fieldPackage')],
    ] as const
    for (const [field, value, label] of required) {
      if (!value.trim()) errors[field] = t('appSettings.fieldRequired', { field: label })
    }
    const values: Record<EditableField, string> = {
      name,
      applicationCode,
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
    if (applicationCode.trim() && !isApplicationCode(applicationCode.trim())) {
      errors.applicationCode = t('appSettings.applicationCodeInvalid')
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
        applicationCode: applicationCode.trim(),
        description: description.trim(),
        packageName: packageName.trim(),
        platform,
        regionId,
        projectId: selectedProjectId || undefined,
        repository: repository.trim(),
        status,
      })
      queryClient.setQueryData(queryKeys.applications.detail(application.id), updated)
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      setEditing(false)
      toast.success(t('appSettings.saved'))
    } catch (caught) {
      setError(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('appSettings.errorGeneric'),
        }),
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <BasicSettings
      application={application}
      editing={editing}
      saving={saving}
      dirty={dirty}
      error={error}
      fieldErrors={fieldErrors}
      values={{
        name,
        applicationCode,
        description,
        packageName,
        platform,
        regionId,
        repository,
        status,
      }}
      regions={regions}
      projectId={selectedProjectId}
      projectName={projects.find((p) => p.id === application.projectId)?.name}
      onProjectChange={setProjectId}
      onEdit={() => setEditing(true)}
      onCancel={() => {
        resetDraft()
        setEditing(false)
      }}
      onFieldChange={(field, value) => {
        const setters: Record<EditableField, (next: string) => void> = {
          name: setName,
          applicationCode: (value) =>
            setApplicationCode(sanitizeApplicationCodeInput(value)),
          description: setDescription,
          packageName: setPackageName,
          repository: setRepository,
        }
        updateField(field, value, setters[field])
      }}
      onPlatformChange={setPlatform}
      onRegionChange={(next) => {
        setRegionId(next)
        setProjectId('')
      }}
      onStatusChange={setStatus}
      onSave={() => void save()}
    />
  )
}

function BasicSettings({
  application,
  editing,
  saving,
  dirty,
  error,
  fieldErrors,
  regions,
  projectId,
  projectName,
  onProjectChange,
  values,
  onEdit,
  onCancel,
  onFieldChange,
  onPlatformChange,
  onRegionChange,
  onStatusChange,
  onSave,
}: {
  application: Application
  editing: boolean
  saving: boolean
  dirty: boolean
  error: string | null
  fieldErrors: Partial<Record<EditableField, string>>
  projectId: string
  projectName?: string
  onProjectChange: (id: string) => void
  regions: Region[]
  values: {
    name: string
    applicationCode: string
    description: string
    packageName: string
    platform: ApplicationPlatform
    regionId: string
    repository: string
    status: ApplicationStatus
  }
  onEdit: () => void
  onCancel: () => void
  onFieldChange: (field: EditableField, value: string) => void
  onPlatformChange: (platform: ApplicationPlatform) => void
  onRegionChange: (regionId: string) => void
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
          <InfoCell label={t('createApp.fieldApplicationCode')} mono>
            {application.applicationCode}
          </InfoCell>
          <InfoCell label={t('createApp.fieldPackage')} mono>
            {application.packageName}
          </InfoCell>
          <InfoCell label={t('createApp.fieldDescription')} className="sm:col-span-2">
            {application.description}
          </InfoCell>
          <InfoCell label={t('createApp.fieldPlatform')}>
            {t(`platform.${application.platform}`)}
          </InfoCell>
          <InfoCell label={t('createApp.fieldRegion')}>
            {application.region.name}
            {projectName ? ` / ${projectName}` : ''}
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
            field="applicationCode"
            label={t('createApp.fieldApplicationCode')}
            value={values.applicationCode}
            error={fieldErrors.applicationCode}
            mono
            hint={t('createApp.applicationCodeHint')}
            onChange={(value) => onFieldChange('applicationCode', value)}
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
          <label className="space-y-1.5">
            <span className="text-[0.8125rem] font-medium text-foreground">
              {t('createApp.fieldRegion')}
            </span>
            <Select value={values.regionId} onValueChange={onRegionChange}>
              <SelectTrigger className="h-8 text-[0.8125rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem
                    key={region.id}
                    value={region.id}
                    disabled={!region.enabled && region.id !== application.region.id}
                  >
                    {region.name}
                    {!region.enabled ? ` · ${t('settings.regionInactive')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <ProjectSelect
            productId={values.regionId}
            value={projectId}
            onChange={onProjectChange}
            disabled={saving}
            currentProjectId={application.projectId}
          />
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
