import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'

import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApplicationPicker } from '@/features/upload/application-picker'
import { FileDropzone } from '@/features/upload/file-dropzone'
import { StepIndicator } from '@/features/upload/step-indicator'
import { StepReview } from '@/features/upload/step-review'
import { StepSuccess } from '@/features/upload/step-success'
import { StepVersion } from '@/features/upload/step-version'
import { useUploadFlow } from '@/features/upload/use-upload-flow'
import { canWriteContent } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { UploadStep } from '@/types/upload'

const STEP_LABEL_KEYS: Record<UploadStep, string> = {
  1: 'upload.stepApplication',
  2: 'upload.stepArtifact',
  3: 'upload.stepVersion',
  4: 'upload.stepReview',
}

export function UploadPage() {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.user?.role)
  const flow = useUploadFlow()

  if (!canWriteContent(role)) {
    return <Navigate to="/" replace />
  }

  if (flow.done && flow.application) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: t('nav.applications'), href: '/' },
          { label: t('upload.breadcrumbUpload') },
        ]}
      >
        <PageContainer rhythm="product">
          <StepSuccess
            application={flow.application}
            version={flow.version.version}
            onAnother={flow.resetAll}
          />
        </PageContainer>
      </AppLayout>
    )
  }

  const stepHint =
    flow.step === 1
      ? t('upload.hint1')
      : flow.step === 2
        ? flow.application
          ? t('upload.hint2', { name: flow.application.name })
          : t('upload.hint2Fallback')
        : flow.step === 3
          ? t('upload.hint3')
          : t('upload.hint4')

  /**
   * Step 1 picker height already ends at the fixed footer.
   * Extra pb-28 would make document taller than the viewport → page scrollbar
   * even though the list itself fits.
   */
  const isAppStep = flow.step === 1

  return (
    <AppLayout
      breadcrumbs={[
        { label: t('nav.applications'), href: '/' },
        { label: t('upload.breadcrumbUpload') },
      ]}
      contentClassName={
        isAppStep ? 'overflow-y-hidden [scrollbar-gutter:auto]' : undefined
      }
    >
      <PageContainer rhythm="product" className={cn(isAppStep ? 'pb-0' : 'pb-28')}>
        <div className="space-y-7 sm:space-y-8">
          <PageHeader
            title={t('upload.title')}
            description={t('upload.stepOf', {
              current: flow.step,
              total: 4,
              label: t(STEP_LABEL_KEYS[flow.step]),
            })}
          />

          <StepIndicator step={flow.step} className="w-full" />

          <div className="w-full space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.8125rem] text-muted-foreground">{stepHint}</p>
              {flow.step >= 2 && flow.application ? (
                <button
                  type="button"
                  onClick={() => flow.setStep(1)}
                  className={cn(
                    'text-[0.8125rem] font-medium text-muted-foreground',
                    'underline-offset-4 transition-colors duration-[var(--duration-hover)]',
                    'hover:text-foreground hover:underline',
                  )}
                >
                  {t('upload.changeApplication')}
                </button>
              ) : null}
            </div>

            <div className="w-full">
              {flow.step === 1 ? (
                <ApplicationPicker
                  value={flow.applicationId}
                  onChange={flow.selectApplication}
                />
              ) : null}

              {flow.step === 2 ? (
                <FileDropzone
                  application={flow.application}
                  phase={flow.phase}
                  fileError={flow.fileError}
                  parsed={flow.parsed}
                  onFile={(file) => flow.processFile(file, flow.application)}
                  onClear={flow.resetFile}
                />
              ) : null}

              {flow.step === 3 ? (
                <StepVersion
                  version={flow.version}
                  applicationPlatform={flow.application?.platform ?? 'zip'}
                  onChange={flow.updateVersion}
                  onChannel={flow.setChannel}
                />
              ) : null}

              {flow.step === 4 && flow.application && flow.parsed ? (
                <StepReview
                  application={flow.application}
                  parsed={flow.parsed}
                  version={flow.version}
                  publishError={flow.publishError}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div
          data-slot="upload-footer"
          className={cn(
            'fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 backdrop-blur-md',
            'dark:border-border',
            'lg:left-[var(--sidebar-width)]',
          )}
        >
          <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-padding-x)]">
            <div className="flex items-center justify-between gap-2.5 py-3.5">
              <div className="flex shrink-0 items-center">
                {flow.step > 1 ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="min-w-[6.5rem] border-0 bg-muted/40 text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
                    onClick={flow.goBack}
                    disabled={flow.publishing}
                  >
                    <ArrowLeft className="size-3.5" />
                    {t('upload.back')}
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="min-w-[6.5rem] border-0 bg-muted/40 text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
                  >
                    <Link to="/">{t('upload.cancel')}</Link>
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {flow.step === 4 ? (
                  <Button
                    type="button"
                    size="lg"
                    className="min-w-[6.5rem]"
                    disabled={flow.publishing}
                    onClick={() => void flow.publish()}
                  >
                    {flow.publishing ? t('upload.publishing') : t('upload.publish')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    className="min-w-[6.5rem]"
                    disabled={!flow.canNext}
                    onClick={() => void flow.goNext()}
                  >
                    {t('upload.next')}
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
