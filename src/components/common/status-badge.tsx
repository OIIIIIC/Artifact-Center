import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Status chips with quiet semantic color.
 * Soft tinted fills — readable differentiation without neon / ERP rainbow.
 */
const statusBadgeVariants = cva(
  'h-5 border-transparent px-1.5 text-[10px] font-medium tracking-wide',
  {
    variants: {
      status: {
        /** Stable / neutral default */
        default:
          'bg-sky-500/10 text-sky-800 normal-case dark:bg-sky-400/15 dark:text-sky-200',
        muted:
          'bg-stone-500/10 text-stone-600 normal-case dark:bg-stone-400/15 dark:text-stone-300',
        /** NEW — fresh intake */
        new: 'bg-teal-500/12 text-teal-800 tracking-wider uppercase dark:bg-teal-400/15 dark:text-teal-300',
        /** Beta — experimental */
        beta: 'bg-violet-500/12 text-violet-800 normal-case dark:bg-violet-400/15 dark:text-violet-300',
        /** Deprecated — caution */
        deprecated:
          'bg-amber-500/12 text-amber-900 normal-case dark:bg-amber-400/15 dark:text-amber-200',
        /** Archived — retired */
        archived:
          'bg-stone-500/10 text-stone-600 normal-case ring-1 ring-stone-400/25 dark:bg-stone-400/10 dark:text-stone-400 dark:ring-stone-500/30',
        /** Active / healthy */
        success:
          'bg-emerald-500/12 text-emerald-800 normal-case dark:bg-emerald-400/15 dark:text-emerald-300',
        warning:
          'bg-amber-500/12 text-amber-900 normal-case dark:bg-amber-400/15 dark:text-amber-200',
        danger:
          'bg-rose-500/12 text-rose-800 normal-case dark:bg-rose-400/15 dark:text-rose-300',
        info: 'bg-sky-500/12 text-sky-800 normal-case dark:bg-sky-400/15 dark:text-sky-200',
      },
    },
    defaultVariants: {
      status: 'default',
    },
  },
)

export interface StatusBadgeProps
  extends ComponentProps<'span'>, VariantProps<typeof statusBadgeVariants> {}

export function StatusBadge({ className, status, ...props }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    />
  )
}

export const APPLICATION_STATUS_LABEL = {
  new: 'NEW',
  beta: 'Beta',
  deprecated: 'Deprecated',
  archived: 'Archived',
  active: null,
} as const
