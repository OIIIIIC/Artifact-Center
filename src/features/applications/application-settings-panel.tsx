import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Archive, CheckCircle2, Loader2, Trash2 } from 'lucide-react'

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

interface ApplicationSettingsPanelProps {
  application: Application
}

/**
 * Application Detail → Settings tab.
 * Full-width like Overview / Artifacts (matches meta + tabs).
 * Two-column field grid on sm+; no page-level FormStack narrow column.
 */
export function ApplicationSettingsPanel({ application }: ApplicationSettingsPanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const updateApplication = useApplicationsStore((s) => s.updateApplication)
  const deleteApplication = useApplicationsStore((s) => s.deleteApplication)

  const [name, setName] = useState(application.name)
  const [description, setDescription] = useState(application.description)
  const [packageName, setPackageName] = useState(application.packageName)
  const [platform, setPlatform] = useState(application.platform)
  const [repository, setRepository] = useState(application.repository)
  const [owner, setOwner] = useState(application.owner)
  const [status, setStatus] = useState(application.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const deleteConfirmRef = useRef<HTMLDivElement>(null)
  const deleteInputRef = useRef<HTMLInputElement>(null)

  // Form state is initialized from application props; remount via key={application.id} on parent when app changes.

  /** Keep confirm UI in view — no manual scroll after opening delete. */
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
      // Focus after scroll starts so keyboard users land on the field
      window.setTimeout(() => {
        deleteInputRef.current?.focus({ preventScroll: true })
      }, 180)
    }, 30)

    return () => window.clearTimeout(scrollTimer)
  }, [confirmDelete])

  const deleteNameMatches = deleteConfirmName.trim() === application.name.trim()

  const dirty =
    name.trim() !== application.name ||
    description.trim() !== application.description ||
    packageName.trim() !== application.packageName ||
    platform !== application.platform ||
    repository.trim() !== application.repository ||
    owner.trim() !== application.owner ||
    status !== application.status

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

  const cardClass = cn(
    'rounded-2xl bg-muted/25 p-5 ring-1 ring-border/60 sm:p-6',
    'dark:bg-muted/15 dark:ring-border/80',
  )

  const onSave = async () => {
    setError(null)
    if (!name.trim() || !description.trim() || !packageName.trim()) {
      setError(t('appSettings.errorRequired'))
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
    toast.success(t('appSettings.saved'), {
      description: result.application.name,
    })
  }

  const onArchive = async () => {
    if (status === 'archived') return
    setArchiving(true)
    await new Promise((r) => setTimeout(r, 280))
    const result = updateApplication(application.id, { status: 'archived' })
    setArchiving(false)
    if (!result.ok) {
      toast.error(t('appSettings.errorGeneric'))
      return
    }
    setStatus('archived')
    toast.success(t('appSettings.archived'), {
      description: application.name,
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
      {/* Same section chrome as Overview / Artifacts tabs */}
      <div>
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          {t('appSettings.title')}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {t('appSettings.description')}
        </p>
      </div>

      {/* General — full width, 2-col fields */}
      <section className={cn(cardClass, 'space-y-5')}>
        <h3 className="text-[0.8125rem] font-medium text-foreground">
          {t('appSettings.sectionGeneral')}
        </h3>

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
      </section>

      {/* Status — semantic colors (aligned with StatusBadge / cards) */}
      <section className={cn(cardClass, 'space-y-4')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[0.8125rem] font-medium text-foreground">
              {t('appSettings.sectionStatus')}
            </h3>
            <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
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
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[0.8125rem] font-medium',
                  'transition-[background-color,box-shadow,color,opacity] duration-[var(--duration-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  'disabled:pointer-events-none disabled:opacity-50',
                  selected ? meta.selected : meta.idle,
                )}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full transition-transform duration-[var(--duration-hover)]',
                    meta.dot,
                    selected && 'scale-110',
                  )}
                  aria-hidden
                />
                {t(`appSettings.status.${s}`)}
              </button>
            )
          })}
        </div>
      </section>

      {error ? (
        <p className="text-[0.8125rem] text-muted-foreground" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          className="h-10 min-w-[6.5rem] rounded-lg"
          disabled={saving || !dirty}
          onClick={() => void onSave()}
        >
          {saving ? t('appSettings.saving') : t('appSettings.save')}
        </Button>
      </div>

      {/*
        Danger zone — GitHub-style red outline.
        Border is clearly red; fill stays soft so content stays readable.
      */}
      <section
        className={cn(
          'overflow-hidden rounded-2xl',
          'border border-destructive/55 bg-destructive/[0.02]',
          'dark:border-destructive/60 dark:bg-destructive/[0.04]',
          'shadow-[0_0_0_1px_color-mix(in_oklab,var(--destructive)_18%,transparent)]',
        )}
      >
        <header
          className={cn(
            'flex items-start gap-3 border-b border-destructive/25 px-5 py-4 sm:px-6',
            'bg-gradient-to-br from-destructive/[0.09] via-destructive/[0.04] to-transparent',
            'dark:border-destructive/30 dark:from-destructive/[0.14] dark:via-destructive/[0.06]',
          )}
        >
          <span
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
              'bg-destructive/12 text-destructive',
              'dark:bg-destructive/18 dark:text-red-300',
            )}
            aria-hidden
          >
            <AlertTriangle className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              {t('appSettings.dangerTitle')}
            </h3>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {t('appSettings.dangerDesc')}
            </p>
          </div>
        </header>

        <ul className="divide-y divide-border/60 bg-card/50 dark:bg-card/30">
          {/* Archive — reversible, stays neutral-amber, not in the red wash */}
          <li className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[0.875rem] font-medium text-foreground">
                  {t('appSettings.archiveTitle')}
                </p>
                <span className="text-[0.6875rem] text-muted-foreground">
                  · {t('appSettings.severityReversible')}
                </span>
              </div>
              <p className="max-w-xl text-[0.8125rem] leading-relaxed text-muted-foreground">
                {t('appSettings.archiveDesc')}
              </p>
              {status === 'archived' ? (
                <p className="inline-flex items-center gap-1.5 pt-1 text-[0.75rem] text-muted-foreground">
                  <CheckCircle2 className="size-3.5 opacity-70" strokeWidth={1.75} />
                  {t('appSettings.alreadyArchivedHint')}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'h-9 w-full shrink-0 gap-1.5 rounded-lg border-0 sm:w-auto',
                'bg-background text-foreground ring-1 ring-border/70',
                'hover:bg-muted/50',
                'dark:bg-background/50 dark:hover:bg-muted/30',
                'disabled:opacity-50',
              )}
              disabled={saving || archiving || status === 'archived'}
              onClick={() => void onArchive()}
            >
              {archiving ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Archive className="size-3.5 opacity-70" strokeWidth={1.75} />
              )}
              {status === 'archived'
                ? t('appSettings.alreadyArchived')
                : archiving
                  ? t('appSettings.archiving')
                  : t('appSettings.archiveAction')}
            </Button>
          </li>

          {/* Delete — confirm replaces the row (compact) + auto-scroll into view */}
          <li className="px-5 py-5 sm:px-6">
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
                  variant="outline"
                  className={cn(
                    'h-9 w-full shrink-0 gap-1.5 rounded-lg border-0 sm:w-auto',
                    'bg-background text-destructive ring-1 ring-destructive/30',
                    'hover:bg-destructive/[0.06] hover:ring-destructive/40',
                    'dark:bg-background/40 dark:hover:bg-destructive/10',
                  )}
                  disabled={deleting || archiving}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                  {t('appSettings.deleteAction')}
                </Button>
              </div>
            ) : (
              <div
                ref={deleteConfirmRef}
                className={cn(
                  'space-y-3 rounded-xl p-4',
                  'bg-destructive/[0.05] ring-1 ring-destructive/20',
                  'dark:bg-destructive/[0.09] dark:ring-destructive/25',
                  'animate-in fade-in-0 slide-in-from-top-1 duration-200',
                )}
                role="region"
                aria-label={t('appSettings.deleteConfirmRegion')}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[0.875rem] font-medium text-foreground">
                      {t('appSettings.deleteTitle')}
                    </p>
                    <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                      {t('appSettings.deleteConfirmLead', {
                        name: application.name,
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                    disabled={deleting}
                    onClick={cancelDeleteConfirm}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>

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
                        'h-10 rounded-lg bg-background/80',
                        'ring-1 ring-destructive/20 focus-visible:ring-destructive/35',
                        'dark:bg-background/40',
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
                    className={cn(
                      'h-10 w-full shrink-0 gap-1.5 rounded-lg sm:w-auto sm:min-w-[7.5rem]',
                      'bg-destructive text-white hover:bg-destructive/90',
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
            )}
          </li>
        </ul>
      </section>
    </div>
  )
}
