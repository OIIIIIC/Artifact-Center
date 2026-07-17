import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AppLayout, FormStack, PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { useApplicationsStore } from '@/store/applications-store'
import type { ApplicationPlatform } from '@/types/application'

const PLATFORMS: ApplicationPlatform[] = ['android', 'windows', 'zip']

/**
 * Create Application — focused form, not ERP CRUD wall.
 */
export function CreateApplicationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createApplication = useApplicationsStore((s) => s.createApplication)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [packageName, setPackageName] = useState('')
  const [platform, setPlatform] = useState<ApplicationPlatform>('android')
  const [repository, setRepository] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim() || !description.trim() || !packageName.trim()) {
      setError(t('createApp.errorRequired'))
      return
    }

    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 400))

    const app = createApplication({
      name,
      description,
      packageName,
      platform,
      repository: repository || undefined,
      owner: user?.name,
    })

    setSubmitting(false)
    toast.success(t('createApp.success'), { description: app.name })
    navigate(`/applications/${app.id}`, { replace: true })
  }

  const fieldClass = cn(
    'h-10 w-full rounded-lg bg-muted/30 px-3 text-[0.875rem] outline-none',
    'ring-1 ring-border/60 transition-[box-shadow,background-color] duration-[var(--duration-hover)]',
    'placeholder:text-muted-foreground/60',
    'focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30',
  )

  return (
    <AppLayout
      breadcrumbs={[
        { label: t('nav.applications'), href: '/' },
        { label: t('createApp.breadcrumb') },
      ]}
    >
      <PageContainer rhythm="product">
        <FormStack className="space-y-8">
          <PageHeader
            title={t('createApp.title')}
            description={t('createApp.description')}
          />

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
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
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('createApp.fieldDescription')}
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('createApp.descriptionPlaceholder')}
                rows={3}
                disabled={submitting}
                required
                className={cn(
                  fieldClass,
                  'h-auto min-h-[5rem] resize-y py-2.5 leading-relaxed',
                )}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('createApp.fieldPackage')}
              </span>
              <Input
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder={t('createApp.packagePlaceholder')}
                className="h-10 rounded-lg font-mono text-[0.8125rem]"
                disabled={submitting}
                required
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('createApp.fieldPlatform')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const active = platform === p
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={submitting}
                      onClick={() => setPlatform(p)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
                        'transition-colors duration-[var(--duration-hover)]',
                        active
                          ? 'bg-foreground text-background'
                          : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t(`platform.${p}`)}
                    </button>
                  )
                })}
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
              />
            </label>

            {error ? (
              <p className="text-[0.8125rem] text-muted-foreground" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <Button
                asChild
                type="button"
                variant="outline"
                className="h-10 min-w-[6.5rem] rounded-lg border-0 bg-muted/40 ring-1 ring-border/60"
              >
                <Link to="/">{t('common.cancel')}</Link>
              </Button>
              <Button
                type="submit"
                className="h-10 min-w-[6.5rem] rounded-lg"
                disabled={submitting}
              >
                {submitting ? t('createApp.creating') : t('createApp.submit')}
              </Button>
            </div>
          </form>
        </FormStack>
      </PageContainer>
    </AppLayout>
  )
}
