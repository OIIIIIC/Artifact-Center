import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  findPackageMatches,
  findSimilarByName,
} from '@/features/applications/create-app-matches'
import { CreateAppReferenceRail } from '@/features/applications/create-app-reference-rail'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useApplicationCatalog } from '@/features/applications/use-applications'
import { ProjectSelect } from '@/features/products/project-select'
import { useProjects } from '@/features/products/use-projects'
import { useRegions } from '@/features/regions/use-regions'
import { queryKeys } from '@/lib/query-keys'
import { APPLICATION_FIELD_LIMITS } from '@/lib/application-fields'
import {
  isApplicationCode,
  sanitizeApplicationCodeInput,
  suggestApplicationCode,
} from '@/lib/application-code'
import { getRequestErrorMessage } from '@/lib/request-error'
import { canWriteContent } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { apiCreateApplication } from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import type { Application, ApplicationPlatform } from '@/types/application'

const PLATFORMS: ApplicationPlatform[] = ['android', 'windows', 'zip']

const sectionClass = cn(
  'rounded-2xl bg-muted/25 ring-1 ring-border/60',
  'dark:bg-muted/15 dark:ring-border/80',
)

const RAIL_LIMIT = 5

/** 合并名称和包名参考应用，同包名应用优先展示。 */
function buildReferenceApps(
  nameSimilar: Application[],
  packageSimilar: Application[],
  packageExact: Application[],
): Application[] {
  const map = new Map<string, Application>()
  for (const app of packageExact) map.set(app.id, app)
  for (const app of nameSimilar) {
    if (!map.has(app.id)) map.set(app.id, app)
  }
  for (const app of packageSimilar) {
    if (!map.has(app.id)) map.set(app.id, app)
  }
  return [...map.values()].slice(0, RAIL_LIMIT)
}

/**
 * 创建应用：以基础信息、交付范围和工程信息分段降低表单密度。
 */
export function CreateApplicationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const { catalog } = useApplicationCatalog()
  const { enabledRegions, loading: regionsLoading } = useRegions()
  const { projects, loading: projectsLoading } = useProjects()

  const [name, setName] = useState('')
  const [applicationCode, setApplicationCode] = useState('')
  const [applicationCodeEdited, setApplicationCodeEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [packageName, setPackageName] = useState('')
  const [platform, setPlatform] = useState<ApplicationPlatform>('android')
  const [regionId, setRegionId] = useState(
    () => searchParams.get('product') ?? searchParams.get('region') ?? '',
  )
  const [projectId, setProjectId] = useState(() => searchParams.get('project') ?? '')
  const selectedProject = projects.find(
    (p) =>
      p.productId === regionId &&
      p.enabled &&
      (projectId ? p.id === projectId : p.isDefault),
  )
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

  const selectedRegion = enabledRegions.find((region) => region.id === regionId)
  const canSubmit =
    !submitting &&
    !regionsLoading &&
    !projectsLoading &&
    Boolean(selectedProject) &&
    Boolean(selectedRegion) &&
    isApplicationCode(applicationCode)
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const continueToMembers = submitter?.value === 'members'
    setError(null)

    if (
      !name.trim() ||
      !isApplicationCode(applicationCode) ||
      !description.trim() ||
      !packageName.trim() ||
      !regionId ||
      !selectedProject
    ) {
      setError(t('createApp.errorRequired'))
      return
    }

    setSubmitting(true)
    try {
      const app = await apiCreateApplication({
        name: name.trim(),
        applicationCode,
        description: description.trim(),
        packageName: packageName.trim(),
        platform,
        regionId,
        projectId: selectedProject?.id,
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
      setError(
        getRequestErrorMessage(err, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('createApp.errorRequired'),
        }),
      )
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
      'inline-flex h-10 min-w-[7.75rem] items-center justify-center gap-2 rounded-lg px-3 text-[0.8125rem] font-medium',
      'ring-1 transition-[box-shadow,background-color,color] duration-[var(--duration-hover)]',
      active
        ? 'bg-primary/[0.05] text-primary ring-primary shadow-sm dark:bg-primary/10'
        : 'bg-background text-foreground ring-border/60 hover:bg-muted/35 hover:ring-border',
      'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
    )

  const regionChipClass = (active: boolean) =>
    cn(
      'inline-flex min-h-10 items-center rounded-lg px-3 text-[0.8125rem] font-medium',
      'ring-1 ring-border/60 transition-[box-shadow,background-color,color] duration-[var(--duration-hover)]',
      active
        ? 'bg-foreground text-background ring-foreground'
        : 'bg-muted/25 text-muted-foreground hover:bg-muted/45 hover:text-foreground hover:ring-border',
      'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
    )

  return (
    <AppLayout
      breadcrumbs={[
        { label: t('nav.applications'), href: '/' },
        { label: t('createApp.breadcrumb') },
      ]}
    >
      <PageContainer rhythm="product">
        <div className="space-y-6 sm:space-y-8">
          <PageHeader title={t('createApp.title')} />

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-5 sm:space-y-6">
            <section className={sectionClass}>
              <div className="space-y-6 p-5 sm:p-7">
                <div>
                  <h2 className="text-[1rem] font-semibold tracking-tight text-foreground">
                    {t('createApp.sectionBasics')}
                  </h2>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {t('createApp.sectionBasicsHint')}
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-6">
                  <label className="block space-y-1.5">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldName')}
                    </span>
                    <Input
                      value={name}
                      onChange={(e) => {
                        const nextName = e.target.value
                        setName(nextName)
                        if (!applicationCodeEdited) {
                          setApplicationCode(
                            suggestApplicationCode(nextName, packageName),
                          )
                        }
                        if (error) setError(null)
                      }}
                      placeholder={t('createApp.namePlaceholder')}
                      className="h-10 rounded-lg"
                      disabled={submitting}
                      maxLength={APPLICATION_FIELD_LIMITS.name}
                      required
                      autoFocus
                      autoComplete="off"
                    />
                    <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
                      {t('createApp.nameHint')}
                    </span>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldApplicationCode')}
                    </span>
                    <Input
                      value={applicationCode}
                      onChange={(e) => {
                        setApplicationCodeEdited(true)
                        setApplicationCode(sanitizeApplicationCodeInput(e.target.value))
                        if (error) setError(null)
                      }}
                      placeholder={t('createApp.applicationCodePlaceholder')}
                      className="h-10 rounded-lg font-mono text-[0.8125rem]"
                      disabled={submitting}
                      maxLength={APPLICATION_FIELD_LIMITS.applicationCode}
                      required
                      autoComplete="off"
                    />
                    <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
                      {t('createApp.applicationCodeHint')}
                    </span>
                  </label>

                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldPackage')}
                    </span>
                    <Input
                      value={packageName}
                      onChange={(e) => {
                        const nextPackageName = e.target.value
                        setPackageName(nextPackageName)
                        if (!applicationCodeEdited) {
                          setApplicationCode(
                            suggestApplicationCode(name, nextPackageName),
                          )
                        }
                        if (error) setError(null)
                      }}
                      placeholder={t('createApp.packagePlaceholder')}
                      className="h-10 rounded-lg font-mono text-[0.8125rem]"
                      disabled={submitting}
                      maxLength={APPLICATION_FIELD_LIMITS.packageName}
                      required
                      autoComplete="off"
                    />
                    <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
                      {t('createApp.packageHint')}
                    </span>
                  </label>

                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldDescription')}
                    </span>
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value)
                        if (error) setError(null)
                      }}
                      placeholder={t('createApp.descriptionPlaceholder')}
                      rows={3}
                      disabled={submitting}
                      maxLength={APPLICATION_FIELD_LIMITS.description}
                      required
                      className={cn(
                        fieldClass,
                        'h-auto min-h-[6.25rem] resize-y py-2.5 leading-relaxed',
                      )}
                    />
                    <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
                      {t('createApp.descriptionHint')}
                    </span>
                  </label>
                </div>

                <CreateAppReferenceRail apps={referenceApps} />
              </div>
            </section>

            <section className={cn(sectionClass, 'bg-card shadow-sm dark:bg-card/70')}>
              <div className="space-y-6 p-5 sm:p-7">
                <div>
                  <h2 className="text-[1rem] font-semibold tracking-tight text-foreground">
                    {t('createApp.sectionScope')}
                  </h2>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {t('createApp.sectionScopeHint')}
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-6">
                  <div className="space-y-2.5">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldPlatform')}
                    </span>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label={t('createApp.fieldPlatform')}
                    >
                      {PLATFORMS.map((p) => {
                        const Icon = PLATFORM_ICON[p]
                        return (
                          <button
                            key={p}
                            type="button"
                            disabled={submitting}
                            onClick={() => setPlatform(p)}
                            className={platformChipClass(platform === p)}
                            aria-pressed={platform === p}
                          >
                            <Icon className="size-3.5" strokeWidth={1.9} />
                            {t(`platform.${p}`)}
                          </button>
                        )
                      })}
                    </div>
                    <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
                      {t('createApp.platformHint')}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-[0.8125rem] font-medium text-foreground">
                      {t('createApp.fieldRegion')}
                    </span>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="radiogroup"
                      aria-label={t('createApp.fieldRegion')}
                    >
                      {enabledRegions.map((region) => (
                        <button
                          key={region.id}
                          type="button"
                          role="radio"
                          aria-checked={regionId === region.id}
                          disabled={submitting || regionsLoading}
                          onClick={() => {
                            setRegionId(region.id)
                            setProjectId('')
                          }}
                          className={regionChipClass(regionId === region.id)}
                        >
                          {region.name}
                        </button>
                      ))}
                    </div>
                    {regionsLoading ? (
                      <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
                        {t('createApp.regionsLoading')}
                      </span>
                    ) : enabledRegions.length === 0 ? (
                      <span className="block text-[0.75rem] text-destructive">
                        {t('createApp.noRegions')}{' '}
                        <Link to="/products" className="underline underline-offset-2">
                          {t('createApp.manageRegions')}
                        </Link>
                      </span>
                    ) : (
                      <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
                        {t('createApp.regionHint')}
                      </span>
                    )}
                  </div>
                  <ProjectSelect
                    productId={regionId}
                    value={selectedProject?.id ?? ''}
                    onChange={setProjectId}
                    disabled={submitting}
                  />
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="space-y-6 p-5 sm:p-7">
                <div>
                  <h2 className="text-[1rem] font-semibold tracking-tight text-foreground">
                    {t('createApp.sectionEngineering')}
                  </h2>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {t('createApp.sectionEngineeringHint')}
                  </p>
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
                  <span className="block text-[0.75rem] leading-relaxed text-muted-foreground">
                    {t('createApp.repositoryHint')}
                  </span>
                </label>
              </div>
            </section>

            <FormError message={error} />

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
              <Button
                asChild
                type="button"
                size="lg"
                variant="outline"
                className="min-w-[6.5rem]"
              >
                <Link to="/">{t('common.cancel')}</Link>
              </Button>
              <Button
                type="submit"
                size="lg"
                variant="outline"
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
                className="min-w-[7rem]"
                disabled={!canSubmit}
                name="next"
                value="detail"
              >
                {submitting ? t('createApp.creating') : t('createApp.submit')}
              </Button>
            </div>
          </form>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
