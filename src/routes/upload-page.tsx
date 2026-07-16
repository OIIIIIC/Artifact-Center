import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AppLayout, PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApplicationPicker } from '@/features/upload/application-picker'
import { FileDropzone } from '@/features/upload/file-dropzone'
import { StepIndicator } from '@/features/upload/step-indicator'
import { StepReview } from '@/features/upload/step-review'
import { StepSuccess } from '@/features/upload/step-success'
import { StepVersion } from '@/features/upload/step-version'
import { useUploadFlow } from '@/features/upload/use-upload-flow'
import { cn } from '@/lib/utils'
import { STEP_LABELS } from '@/types/upload'

/**
 * Upload Artifact — multi-step flow (Vercel Deploy / GitHub Release style).
 * All processing is mocked.
 */
export function UploadPage() {
  const flow = useUploadFlow()

  if (flow.done && flow.application) {
    return (
      <AppLayout
        breadcrumbs={[{ label: 'Applications', href: '/' }, { label: 'Upload' }]}
        showSearch={false}
      >
        <PageContainer className="pb-20 pt-10">
          <StepSuccess
            application={flow.application}
            version={flow.version.version}
            onAnother={flow.resetAll}
          />
        </PageContainer>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Applications', href: '/' }, { label: 'Upload' }]}
      showSearch={false}
    >
      <PageContainer className="pb-28 pt-8 sm:pt-10">
        <div className="mx-auto max-w-2xl space-y-8 sm:space-y-10">
          <header className="space-y-1.5 text-center sm:text-left">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground sm:text-[1.875rem]">
              Upload Artifact
            </h1>
            <p className="text-[0.875rem] text-muted-foreground">
              {STEP_LABELS[flow.step]} · 一步只做一件事
            </p>
          </header>

          <StepIndicator step={flow.step} />

          <div className="min-h-[20rem]">
            {flow.step === 1 ? (
              <div className="space-y-3">
                <p className="text-[0.8125rem] text-muted-foreground">
                  Choose where this build belongs.
                </p>
                <ApplicationPicker
                  value={flow.applicationId}
                  onChange={flow.selectApplication}
                />
              </div>
            ) : null}

            {flow.step === 2 ? (
              <div className="space-y-3">
                <p className="text-[0.8125rem] text-muted-foreground">
                  Drop the package for{' '}
                  <span className="font-medium text-foreground">
                    {flow.application?.name}
                  </span>
                  .
                </p>
                <FileDropzone
                  application={flow.application}
                  phase={flow.phase}
                  fileError={flow.fileError}
                  parsed={flow.parsed}
                  onFile={(file) => flow.processFile(file, flow.application)}
                  onClear={flow.resetFile}
                />
              </div>
            ) : null}

            {flow.step === 3 ? (
              <div className="space-y-3">
                <p className="text-[0.8125rem] text-muted-foreground">
                  Confirm version metadata. Notes and channel are yours to edit.
                </p>
                <StepVersion
                  version={flow.version}
                  onChange={flow.updateVersion}
                  onChannel={flow.setChannel}
                />
              </div>
            ) : null}

            {flow.step === 4 && flow.application && flow.parsed ? (
              <div className="space-y-3">
                <p className="text-[0.8125rem] text-muted-foreground">
                  Review once, then publish.
                </p>
                <StepReview
                  application={flow.application}
                  parsed={flow.parsed}
                  version={flow.version}
                  publishError={flow.publishError}
                  draftSaved={flow.draftSaved}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Sticky footer actions */}
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 backdrop-blur-md',
            'dark:border-border',
          )}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-[var(--page-padding-x)] py-3">
            <div className="flex items-center gap-2">
              {flow.step > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={flow.goBack}
                  disabled={flow.publishing}
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </Button>
              ) : (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Link to="/">Cancel</Link>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {flow.step === 4 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-0 bg-muted/40 ring-1 ring-border/60"
                    disabled={flow.publishing}
                    onClick={() => void flow.saveDraft()}
                  >
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-lg"
                    disabled={flow.publishing}
                    onClick={() => void flow.publish()}
                  >
                    {flow.publishing ? 'Publishing…' : 'Publish'}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 rounded-lg"
                  disabled={!flow.canNext}
                  onClick={flow.goNext}
                >
                  Next
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
