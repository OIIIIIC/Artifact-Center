import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  findPackageMatches,
  findSimilarByName,
} from '@/features/applications/create-app-matches'
import { CreateAppReferenceRail } from '@/features/applications/create-app-reference-rail'
import { useApplicationCatalog } from '@/features/applications/use-applications'
import { queryKeys } from '@/lib/query-keys'
import { APPLICATION_FIELD_LIMITS } from '@/lib/application-fields'
import { canWriteContent } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { ApiError } from '@/services/http'
import { apiCreateApplication } from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import type { Application, ApplicationPlatform } from '@/types/application'

const PLATFORMS: ApplicationPlatform[] = ['android', 'windows', 'zip']

const panelClass = cn(
  'rounded-2xl bg-muted/25 ring-1 ring-border/60',
  'dark:bg-muted/15 dark:ring-border/80',
)

const RAIL_LIMIT = 5

/** Merge name + package soft matches; exact package conflict listed first when present. */
function buildReferenceApps(
  nameSimilar: Application[],
  packageSimilar: Application[],
  packageExact: Application | null,
): Application[] {
  const map = new Map<string, Application>()
  if (packageExact) map.set(packageExact.id, packageExact)
  for (const app of nameSimilar) {
    if (!map.has(app.id)) map.set(app.id, app)
  }
  for (const app of packageSimilar) {
    if (!map.has(app.id)) map.set(app.id, app)
  }
  return [...map.values()].slice(0, RAIL_LIMIT)
}

/**
 * Create Application — left form track + right naming reference (lg+).
 * Success → Application Detail. Package exact match blocks create.
 */
export function CreateApplicationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const { catalog } = useApplicationCatalog()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [packageName, setPackageName] = useState('')
  const [platform, setPlatform] = useState<ApplicationPlatform>('android')
  const [repository, setRepository] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canWriteContent(role)) {
    return <Navigate to="/" replace />
  }

  const nameSimilar = findSimilarByName(catalog, name, RAIL_LIMIT)
  const packageMatch = findPackageMatches(catalog, packageName, RAIL_LIMIT)
  const referenceApps = buildReferenceApps(
    nameSimilar,
    packageMatch.similar,
    packageMatch.exact,
  )

  const packageTaken = packageMatch.exact != null
  const canSubmit = !submitting && !packageTaken

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const continueToMembers = submitter?.value === 'members'
    setError(null)

    if (!name.trim() || !description.trim() || !packageName.trim()) {
      setError(t('createApp.errorRequired'))
      return
    }

    if (packageTaken) {
      setError(
        t('createApp.packageTaken', {
          name: packageMatch.exact!.name,
        }),
      )
      return
    }

    setSubmitting(true)
    try {
      const app = await apiCreateApplication({
        name: name.trim(),
        description: description.trim(),
        packageName: packageName.trim(),
        platform,
        repository: repository.trim() || undefined,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      toast.success(t('createApp.success'), { description: app.name })
      navigate(
        continueToMembers
          ? `/applications/${app.id}?tab=settings&addMember=1`
          : `/applications/${app.id}`,
        { replace: true },
      )
    } catch (err) {
      if (err instanceof ApiError && err.code === 'package_taken') {
        setError(
          t('createApp.packageTaken', {
            name: packageName.trim(),
          }),
        )
      } else {
        setError(t('createApp.errorRequired'))
      }
    } finally {
      setSubmitting(false)
    }
  }

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

  return (
    <AppLayout
      breadcrumbs={[
        { label: t('nav.applications'), href: '/' },
        { label: t('createApp.breadcrumb') },
      ]}
    >
      <PageContainer rhythm="product">
        {/*
          Full product shell width (same left edge as list/detail).
          lg+: form column + reference rail. Narrow: rail stacks under form.
        */}
        <div className="space-y-6 sm:space-y-8">
          <PageHeader
            title={t('createApp.title')}
            description={t('createApp.description')}
          />

          <div
            className={cn(
              'grid items-start gap-6',
              'lg:grid-cols-[minmax(0,40rem)_minmax(16rem,20rem)] lg:gap-8',
              'xl:grid-cols-[minmax(0,42rem)_minmax(17rem,22rem)]',
            )}
          >
            <form onSubmit={(e) => void onSubmit(e)} className={panelClass}>
              <div className="space-y-6 p-5 sm:p-6">
                <div>
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                    {t('createApp.sectionBasics')}
                  </h2>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                    {t('createApp.sectionBasicsHint')}
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
                  <label className="block space-y-1.5">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldName')}
                    </span>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('createApp.namePlaceholder')}
                      className="h-10 rounded-lg"
                      disabled={submitting}
                      maxLength={APPLICATION_FIELD_LIMITS.name}
                      required
                      autoFocus
                      autoComplete="off"
                    />
                  </label>

                  <div className="min-w-0 space-y-1.5">
                    <label className="block space-y-1.5">
                      <span className="text-[0.8125rem] font-medium text-foreground">
                        {t('createApp.fieldPackage')}
                      </span>
                      <Input
                        value={packageName}
                        onChange={(e) => {
                          setPackageName(e.target.value)
                          if (error) setError(null)
                        }}
                        placeholder={t('createApp.packagePlaceholder')}
                        className={cn(
                          'h-10 rounded-lg font-mono text-[0.8125rem]',
                          packageTaken &&
                            'ring-1 ring-border-strong focus-visible:ring-ring/30',
                        )}
                        disabled={submitting}
                        maxLength={APPLICATION_FIELD_LIMITS.packageName}
                        required
                        autoComplete="off"
                        aria-invalid={packageTaken || undefined}
                      />
                    </label>
                    {/* Hard conflict only — soft matches live in the rail */}
                    {packageMatch.exact ? (
                      <p
                        className="text-[0.75rem] leading-relaxed text-muted-foreground"
                        role="alert"
                      >
                        {t('createApp.packageTakenLead', {
                          name: packageMatch.exact.name,
                        })}
                      </p>
                    ) : null}
                  </div>

                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldDescription')}
                    </span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('createApp.descriptionPlaceholder')}
                      rows={3}
                      disabled={submitting}
                      maxLength={APPLICATION_FIELD_LIMITS.description}
                      required
                      className={cn(
                        fieldClass,
                        'h-auto min-h-[5rem] resize-y py-2.5 leading-relaxed',
                      )}
                    />
                  </label>

                  <div className="space-y-1.5">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldPlatform')}
                    </span>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label={t('createApp.fieldPlatform')}
                    >
                      {PLATFORMS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={submitting}
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
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[0.8125rem] font-medium text-foreground">
                        {t('createApp.fieldRepository')}
                      </span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {t('createApp.optional')}
                      </span>
                    </span>
                    <Input
                      value={repository}
                      onChange={(e) => setRepository(e.target.value)}
                      placeholder={t('createApp.repositoryPlaceholder')}
                      className="h-10 rounded-lg font-mono text-[0.8125rem]"
                      disabled={submitting}
                      maxLength={APPLICATION_FIELD_LIMITS.repository}
                    />
                  </label>
                </div>

                {error ? (
                  <p className="text-[0.8125rem] text-muted-foreground" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>

              <div
                className={cn(
                  'flex flex-wrap items-center justify-end gap-2.5',
                  'border-t border-border/50 px-5 py-4 sm:px-6',
                )}
              >
                <Button
                  asChild
                  type="button"
                  size="lg"
                  variant="outline"
                  className="min-w-[6.5rem] border-0 bg-background/80 ring-1 ring-border/60 dark:bg-background/40"
                >
                  <Link to="/">{t('common.cancel')}</Link>
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  variant="outline"
                  className="border-0 bg-background/80 ring-1 ring-border/60 dark:bg-background/40"
                  disabled={!canSubmit}
                  name="next"
                  value="members"
                >
                  {submitting
                    ? t('createApp.creating')
                    : t('createApp.submitAndAddMembers')}
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="min-w-[6.5rem]"
                  disabled={!canSubmit}
                  name="next"
                  value="detail"
                >
                  {submitting ? t('createApp.creating') : t('createApp.submit')}
                </Button>
              </div>
            </form>

            <CreateAppReferenceRail
              apps={referenceApps}
              conflictId={packageMatch.exact?.id}
              className={cn(
                'min-w-0',
                /* Sit beside form on large screens; sticky while scrolling */
                'lg:sticky lg:top-6',
              )}
            />
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
