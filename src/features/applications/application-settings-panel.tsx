import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Pencil, Trash2, X } from 'lucide-react'

import { StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { APPLICATION_STATUS_CHIP } from '@/features/applications/application-status-meta'
import { cn } from '@/lib/utils'
import { useApplicationsStore } from '@/store/applications-store'
import type {
  Application,
  ApplicationPlatform,
  ApplicationStatus,
} from '@/types/application'

const PLATFORMS: ApplicationPlatform[] = ['android', 'windows', 'zip']

const STATUSES: ApplicationStatus[] = ['active', 'new', 'beta', 'deprecated', 'archived']

/** Light container — aligned with detail summary / release-note cards. */
const sectionCardClass = cn(
  'rounded-2xl bg-muted/25 p-5 ring-1 ring-border/60 sm:p-6',
  'dark:bg-muted/15 dark:ring-border/80',
)

interface ApplicationSettingsPanelProps {
  application: Application
}

/**
 * Application Detail → Settings tab.
 * Three first-level cards: identity (read-first), lifecycle, delete danger zone.
 */
export function ApplicationSettingsPanel({ application }: ApplicationSettingsPanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const updateApplication = useApplicationsStore((s) => s.updateApplication)
  const deleteApplication = useApplicationsStore((s) => s.deleteApplication)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(application.name)
  const [description, setDescription] = useState(application.description)
  const [packageName, setPackageName] = useState(application.packageName)
  const [platform, setPlatform] = useState(application.platform)
  const [repository, setRepository] = useState(application.repository)
  const [owner, setOwner] = useState(application.owner)
  const [status, setStatus] = useState<ApplicationStatus>(application.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const deleteConfirmRef = useRef<HTMLDivElement>(null)
  const deleteInputRef = useRef<HTMLInputElement>(null)

  // Form state is initialized from application props; remount via key={application.id} on parent when app changes.

  useEffect(() => {
    if (!confirmDelete) return
    const el = deleteConfirmRef.current
    if (!el) return

    const scrollTimer = window.setTimeout(() => {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      })
      window.setTimeout(() => {
        deleteInputRef.current?.focus({ preventScroll: true })
      }, 180)
    }, 30)

    return () => window.clearTimeout(scrollTimer)
  }, [confirmDelete])

  const deleteNameMatches = deleteConfirmName.trim() === application.name.trim()

  const infoDirty =
    name.trim() !== application.name ||
    description.trim() !== application.description ||
    packageName.trim() !== application.packageName ||
    platform !== application.platform ||
    repository.trim() !== application.repository ||
    owner.trim() !== application.owner

  const statusDirty = status !== application.status
  const dirty = infoDirty || statusDirty

  const fieldClass = cn(
    'h-10 w-full rounded-lg bg-muted/30 px-3 text-[0.875rem] outline-none',
    'ring-1 ring-border/60 transition-[box-shadow,background-color] duration-[var(--duration-hover)]',
    'placeholder:text-muted-foreground/60',
    'focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30',
  )

  const platformChipClass = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
      'transition-colors duration-[var(--duration-hover)]',
      active
        ? 'bg-foreground text-background'
        : 'bg-muted/40 text-muted-foreground hover:text-foreground',
    )

  const resetInfoFromApp = () => {
    setName(application.name)
    setDescription(application.description)
    setPackageName(application.packageName)
    setPlatform(application.platform)
    setRepository(application.repository)
    setOwner(application.owner)
    setError(null)
  }

  const startEditing = () => {
    resetInfoFromApp()
    setEditing(true)
  }

  const cancelEditing = () => {
    resetInfoFromApp()
    setEditing(false)
  }

  const onSave = async () => {
    setError(null)
    if (!name.trim() || !description.trim() || !packageName.trim()) {
      setError(t('appSettings.errorRequired'))
      if (!editing) setEditing(true)
      return
    }
    setSaving(true)
    await new Promise((r) => setTimeout(r, 320))
    const result = updateApplication(application.id, {
      name,
      description,
      packageName,
      platform,
      repository,
      owner,
      status,
    })
    setSaving(false)
    if (!result.ok) {
      setError(t('appSettings.errorRequired'))
      return
    }
    setEditing(false)
    setStatus(result.application.status)
    toast.success(t('appSettings.saved'), {
      description: result.application.name,
    })
  }

  const onDelete = async () => {
    if (!deleteNameMatches) {
      toast.error(t('appSettings.deleteNameMismatch'))
      return
    }
    setDeleting(true)
    await new Promise((r) => setTimeout(r, 350))
    const result = deleteApplication(application.id)
    setDeleting(false)
    if (!result.ok) {
      toast.error(t('appSettings.errorGeneric'))
      setConfirmDelete(false)
      setDeleteConfirmName('')
      return
    }
    toast.success(t('appSettings.deleted'), {
      description: application.name,
    })
    navigate('/', { replace: true })
  }

  const cancelDeleteConfirm = () => {
    setConfirmDelete(false)
    setDeleteConfirmName('')
  }

  return (
    <div className="w-full space-y-4">
      {/* ── 1. 应用信息 ── */}
      <section className={cn(sectionCardClass, 'space-y-5')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              {t('appSettings.sectionInfo')}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              {t('appSettings.sectionInfoHint')}
            </p>
          </div>
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'border-0 bg-background/80 text-foreground ring-1 ring-border/60',
                'hover:bg-muted/50',
                'dark:bg-background/40 dark:hover:bg-muted/30',
              )}
              onClick={startEditing}
            >
              <Pencil className="size-3.5 opacity-70" strokeWidth={1.75} />
              {t('appSettings.edit')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              disabled={saving}
              onClick={cancelEditing}
            >
              <X className="size-3.5 opacity-70" strokeWidth={1.75} />
              {t('appSettings.cancelEdit')}
            </Button>
          )}
        </div>

        {!editing ? (
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <InfoCell label={t('createApp.fieldName')}>{application.name}</InfoCell>
            <InfoCell label={t('createApp.fieldPackage')} mono>
              {application.packageName}
            </InfoCell>
            <InfoCell label={t('createApp.fieldDescription')} className="sm:col-span-2">
              <span className="leading-relaxed text-muted-foreground">
                {application.description}
              </span>
            </InfoCell>
            <InfoCell label={t('createApp.fieldPlatform')}>
              {t(`platform.${application.platform}`)}
            </InfoCell>
            <InfoCell label={t('appSettings.fieldOwner')}>{application.owner}</InfoCell>
            <InfoCell
              label={t('createApp.fieldRepository')}
              mono
              className="sm:col-span-2"
            >
              {application.repository || t('appSettings.emptyValue')}
            </InfoCell>
          </dl>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('createApp.fieldName')}
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-lg"
                disabled={saving}
                autoFocus
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('createApp.fieldPackage')}
              </span>
              <Input
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="h-10 rounded-lg font-mono text-[0.8125rem]"
                disabled={saving}
              />
            </label>

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('createApp.fieldDescription')}
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={saving}
                className={cn(
                  fieldClass,
                  'h-auto min-h-[5rem] resize-y py-2.5 leading-relaxed',
                )}
              />
            </label>

            <div className="space-y-1.5 sm:col-span-2">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('createApp.fieldPlatform')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={saving}
                    onClick={() => setPlatform(p)}
                    className={platformChipClass(platform === p)}
                    aria-pressed={platform === p}
                  >
                    {t(`platform.${p}`)}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('createApp.fieldRepository')}
              </span>
              <Input
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                className="h-10 rounded-lg font-mono text-[0.8125rem]"
                disabled={saving}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('appSettings.fieldOwner')}
              </span>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="h-10 rounded-lg"
                disabled={saving}
              />
            </label>
          </div>
        )}
      </section>

      {/* ── 2. 生命周期状态 ── */}
      <section className={cn(sectionCardClass, 'space-y-4')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              {t('appSettings.sectionStatus')}
            </h2>
            <p className="mt-0.5 max-w-xl text-[0.8125rem] leading-relaxed text-muted-foreground">
              {t('appSettings.statusHint')}
            </p>
          </div>
          <StatusBadge
            status={APPLICATION_STATUS_CHIP[status].badge}
            className={cn(
              'h-6 px-2 text-[11px]',
              status === 'new' ? 'uppercase tracking-wider' : 'normal-case',
            )}
          >
            {t(`appSettings.status.${status}`)}
          </StatusBadge>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('appSettings.sectionStatus')}
        >
          {STATUSES.map((s) => {
            const meta = APPLICATION_STATUS_CHIP[s]
            const selected = status === s
            return (
              <button
                key={s}
                type="button"
                disabled={saving}
                onClick={() => setStatus(s)}
                aria-pressed={selected}
                className={cn(
                  'inline-flex items-center rounded-lg px-3 py-2 text-[0.8125rem] font-medium',
                  'transition-[background-color,box-shadow,color,opacity] duration-[var(--duration-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  'disabled:pointer-events-none disabled:opacity-50',
                  selected ? meta.selected : meta.idle,
                )}
              >
                {t(`appSettings.status.${s}`)}
              </button>
            )
          })}
        </div>
      </section>

      {error ? (
        <p className="px-0.5 text-[0.8125rem] text-muted-foreground" role="alert">
          {error}
        </p>
      ) : null}

      {/* Single primary — only after changes */}
      {dirty ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            className="min-w-[6.5rem]"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? t('appSettings.saving') : t('appSettings.save')}
          </Button>
        </div>
      ) : null}

      {/*
        ── 3. 危险操作 ──
        Outer card carries all danger chrome. Confirm expands in-place
        with flat layout only — no nested red panel.
      */}
      <section
        className={cn(
          'overflow-hidden rounded-2xl',
          'border border-destructive/40 bg-destructive/[0.02]',
          'dark:border-destructive/45 dark:bg-destructive/[0.03]',
        )}
      >
        <header className="flex items-start gap-3 border-b border-destructive/25 px-5 py-4 sm:px-6 dark:border-destructive/30">
          <span
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
              'bg-destructive/10 text-destructive',
              'dark:bg-destructive/15',
            )}
            aria-hidden
          >
            <AlertTriangle className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              {t('appSettings.dangerTitle')}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {t('appSettings.dangerDesc')}
            </p>
          </div>
        </header>

        <div className="px-5 py-5 sm:px-6">
          {!confirmDelete ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[0.875rem] font-medium text-foreground">
                    {t('appSettings.deleteTitle')}
                  </p>
                  <span className="text-[0.6875rem] text-muted-foreground">
                    · {t('appSettings.severityIrreversible')}
                  </span>
                </div>
                <p className="max-w-xl text-[0.8125rem] leading-relaxed text-muted-foreground">
                  {t('appSettings.deleteDesc')}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full shrink-0 sm:w-auto"
                disabled={deleting}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                {t('appSettings.deleteAction')}
              </Button>
            </div>
          ) : (
            <div
              ref={deleteConfirmRef}
              className="space-y-4"
              role="region"
              aria-label={t('appSettings.deleteConfirmRegion')}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[0.875rem] font-medium text-foreground">
                      {t('appSettings.deleteTitle')}
                    </p>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      · {t('appSettings.severityIrreversible')}
                    </span>
                  </div>
                  <p className="max-w-xl text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {t('appSettings.deleteConfirmLead', {
                      name: application.name,
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  disabled={deleting}
                  onClick={cancelDeleteConfirm}
                >
                  {t('common.cancel')}
                </Button>
              </div>

              <div className="border-t border-border/50 pt-4">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 space-y-1.5">
                    <span className="text-[0.75rem] font-medium text-foreground">
                      {t('appSettings.deleteConfirmLabel')}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        ({application.name})
                      </span>
                    </span>
                    <Input
                      ref={deleteInputRef}
                      value={deleteConfirmName}
                      onChange={(e) => setDeleteConfirmName(e.target.value)}
                      placeholder={t('appSettings.deleteConfirmPlaceholder')}
                      disabled={deleting}
                      autoComplete="off"
                      className={cn(
                        'h-10 rounded-lg',
                        /* Calm focus: thin ring instead of default ring-3 */
                        'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/35',
                      )}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          cancelDeleteConfirm()
                        }
                        if (e.key === 'Enter' && deleteNameMatches && !deleting) {
                          e.preventDefault()
                          void onDelete()
                        }
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    size="lg"
                    variant="destructive"
                    className={cn(
                      'w-full shrink-0 sm:w-auto sm:min-w-[7.5rem]',
                      'disabled:opacity-40',
                    )}
                    disabled={deleting || !deleteNameMatches}
                    onClick={() => void onDelete()}
                  >
                    {deleting ? (
                      <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    )}
                    {deleting
                      ? t('appSettings.deleting')
                      : t('appSettings.confirmDelete')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
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
      <dt className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 text-[0.875rem] text-foreground',
          mono && 'font-mono text-[0.8125rem] text-muted-foreground',
        )}
      >
        {children}
      </dd>
    </div>
  )
}
