import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApplicationPicker } from '@/features/upload/application-picker'
import { FileDropzone } from '@/features/upload/file-dropzone'
import { StepIndicator } from '@/features/upload/step-indicator'
import { StepReview } from '@/features/upload/step-review'
import { StepSuccess } from '@/features/upload/step-success'
import { StepVersion } from '@/features/upload/step-version'
import { useUploadFlow } from '@/features/upload/use-upload-flow'
import { cn } from '@/lib/utils'
import type { UploadStep } from '@/types/upload'

const STEP_LABEL_KEYS: Record<UploadStep, string> = {
  1: 'upload.stepApplication',
  2: 'upload.stepArtifact',
  3: 'upload.stepVersion',
  4: 'upload.stepReview',
}

export function UploadPage() {
  const { t } = useTranslation()
  const flow = useUploadFlow()

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

  return (
    <AppLayout
      breadcrumbs={[
        { label: t('nav.applications'), href: '/' },
        { label: t('upload.breadcrumbUpload') },
      ]}
    >
      <PageContainer rhythm="product" className="pb-28">
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
            <p className="text-[0.8125rem] text-muted-foreground">{stepHint}</p>

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
                  draftSaved={flow.draftSaved}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 backdrop-blur-md',
            'dark:border-border',
            'lg:left-[var(--sidebar-width)]',
          )}
        >
          <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-padding-x)]">
            <div className="flex items-center justify-end gap-2.5 py-3.5">
              {flow.step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-[6.5rem] gap-1.5 rounded-lg border-0 bg-muted/40 text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
                  onClick={flow.goBack}
                  disabled={flow.publishing}
                >
                  <ArrowLeft className="size-3.5" />
                  {t('upload.back')}
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="h-10 min-w-[6.5rem] rounded-lg border-0 bg-muted/40 text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
                >
                  <Link to="/">{t('upload.cancel')}</Link>
                </Button>
              )}

              {flow.step === 4 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-[6.5rem] rounded-lg border-0 bg-muted/40 ring-1 ring-border/60"
                    disabled={flow.publishing}
                    onClick={() => void flow.saveDraft()}
                  >
                    {t('upload.saveDraft')}
                  </Button>
                  <Button
                    type="button"
                    className="h-10 min-w-[6.5rem] rounded-lg"
                    disabled={flow.publishing}
                    onClick={() => void flow.publish()}
                  >
                    {flow.publishing ? t('upload.publishing') : t('upload.publish')}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="h-10 min-w-[6.5rem] gap-1.5 rounded-lg"
                  disabled={!flow.canNext}
                  onClick={flow.goNext}
                >
                  {t('upload.next')}
                  <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
