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

/** Shared upload column — same width for every step + footer actions */
const UPLOAD_COL = 'mx-auto w-full max-w-4xl'

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
          <div className={UPLOAD_COL}>
            <StepSuccess
              application={flow.application}
              version={flow.version.version}
              onAnother={flow.resetAll}
            />
          </div>
        </PageContainer>
      </AppLayout>
    )
  }

  const stepHint: Record<1 | 2 | 3 | 4, string> = {
    1: 'Choose where this build belongs.',
    2: flow.application
      ? `Drop the package for ${flow.application.name}.`
      : 'Drop the package.',
    3: 'Confirm version metadata. Notes and channel are yours to edit.',
    4: 'Review once, then publish.',
  }

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Applications', href: '/' }, { label: 'Upload' }]}
      showSearch={false}
    >
      <PageContainer className="pb-28 pt-8 sm:pt-10">
        {/*
          Single column shell: header / steps / body share identical width.
          Step components must stay w-full (no nested max-w-*) to avoid jump.
        */}
        <div className={cn(UPLOAD_COL, 'space-y-7 sm:space-y-8')}>
          <header className="space-y-1">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground sm:text-[1.875rem]">
              Upload Artifact
            </h1>
            <p className="text-[0.875rem] text-muted-foreground">
              Step {flow.step} of 4 · {STEP_LABELS[flow.step]}
            </p>
          </header>

          <StepIndicator step={flow.step} className="w-full" />

          <div className="w-full space-y-3">
            <p className="text-[0.8125rem] text-muted-foreground">
              {stepHint[flow.step]}
            </p>

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

        {/*
          Footer spans the main column only (not under sidebar), then uses the
          same PageContainer padding + UPLOAD_COL so Cancel/Next line up with content.
        */}
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 backdrop-blur-md',
            'dark:border-border',
            'lg:left-[var(--sidebar-width)]',
          )}
        >
          <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-padding-x)]">
            <div
              className={cn(UPLOAD_COL, 'flex items-center justify-end gap-2.5 py-3.5')}
            >
              {flow.step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-[6.5rem] gap-1.5 rounded-lg border-0 bg-muted/40 text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
                  onClick={flow.goBack}
                  disabled={flow.publishing}
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="h-10 min-w-[6.5rem] rounded-lg border-0 bg-muted/40 text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
                >
                  <Link to="/">Cancel</Link>
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
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    className="h-10 min-w-[6.5rem] rounded-lg"
                    disabled={flow.publishing}
                    onClick={() => void flow.publish()}
                  >
                    {flow.publishing ? 'Publishing…' : 'Publish'}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="h-10 min-w-[6.5rem] gap-1.5 rounded-lg"
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
