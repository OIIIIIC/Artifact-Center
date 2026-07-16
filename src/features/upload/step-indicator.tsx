import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { STEP_LABELS, type UploadStep } from '@/types/upload'

const STEPS: UploadStep[] = [1, 2, 3, 4]

export function StepIndicator({
  step,
  className,
}: {
  step: UploadStep
  className?: string
}) {
  return (
    <nav aria-label="Upload progress" className={cn('w-full', className)}>
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((s, index) => {
          const done = s < step
          const active = s === step
          return (
            <li key={s} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-[var(--duration-hover)]',
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
                    'hidden truncate text-[0.75rem] sm:inline',
                    active ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <div
                  className={cn(
                    'mx-1 h-px min-w-3 flex-1 sm:mx-2',
                    s < step ? 'bg-foreground/40' : 'bg-border',
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
