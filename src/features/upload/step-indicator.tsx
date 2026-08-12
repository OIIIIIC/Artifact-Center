import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { UploadStep } from '@/types/upload'

const STEPS: UploadStep[] = [1, 2, 3, 4]

const STEP_KEYS: Record<UploadStep, string> = {
  1: 'upload.stepApplication',
  2: 'upload.stepArtifact',
  3: 'upload.stepVersion',
  4: 'upload.stepReview',
}

const easeOut = [0.2, 0, 0, 1] as const

export function StepIndicator({
  step,
  className,
}: {
  step: UploadStep
  className?: string
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  return (
    <nav aria-label={t('upload.progressAria')} className={cn('w-full', className)}>
      <ol className="flex w-full items-center">
        {STEPS.map((s, index) => {
          const done = s < step
          const active = s === step
          const isLast = index === STEPS.length - 1

          return (
            <Fragment key={s}>
              <li className="flex shrink-0 items-center gap-2">
                <motion.span
                  initial={false}
                  animate={reduceMotion ? undefined : { scale: active ? 1.08 : 1 }}
                  transition={{ duration: 0.22, ease: easeOut }}
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    'transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
                    done && 'bg-foreground text-background',
                    active && 'bg-foreground text-background ring-4 ring-foreground/10',
                    !done &&
                      !active &&
                      'bg-muted text-muted-foreground ring-1 ring-border/70',
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : s}
                </motion.span>
                <span
                  className={cn(
                    'hidden text-[0.75rem] transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] sm:inline',
                    active ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {t(STEP_KEYS[s])}
                </span>
              </li>

              {!isLast ? (
                <li
                  className="mx-2 h-px min-w-4 flex-1 list-none overflow-hidden bg-border sm:mx-3"
                  aria-hidden
                >
                  <motion.div
                    className="h-px w-full bg-foreground/35"
                    initial={false}
                    animate={{ scaleX: s < step ? 1 : 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { duration: 0.28, ease: easeOut, delay: s < step ? 0.05 : 0 }
                    }
                    style={{ transformOrigin: 'left center' }}
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
