import { Check } from 'lucide-react'
import { Fragment } from 'react'

import { cn } from '@/lib/utils'
import { STEP_LABELS, type UploadStep } from '@/types/upload'

const STEPS: UploadStep[] = [1, 2, 3, 4]

/**
 * Full-width step rail: first step flush left, last flush right —
 * matches Application Picker / dropzone column edges (no visual gap).
 */
export function StepIndicator({
  step,
  className,
}: {
  step: UploadStep
  className?: string
}) {
  return (
    <nav aria-label="Upload progress" className={cn('w-full', className)}>
      <ol className="flex w-full items-center">
        {STEPS.map((s, index) => {
          const done = s < step
          const active = s === step
          const isLast = index === STEPS.length - 1

          return (
            <Fragment key={s}>
              <li className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    'transition-colors duration-[var(--duration-hover)]',
                    done && 'bg-foreground text-background',
                    active && 'bg-foreground text-background ring-4 ring-foreground/10',
                    !done &&
                      !active &&
                      'bg-muted text-muted-foreground ring-1 ring-border/70',
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : s}
                </span>
                <span
                  className={cn(
                    'hidden text-[0.75rem] sm:inline',
                    active ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {STEP_LABELS[s]}
                </span>
              </li>

              {!isLast ? (
                <li className="mx-2 h-px min-w-4 flex-1 list-none sm:mx-3" aria-hidden>
                  <div
                    className={cn(
                      'h-px w-full',
                      s < step ? 'bg-foreground/35' : 'bg-border',
                    )}
                  />
                </li>
              ) : null}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
