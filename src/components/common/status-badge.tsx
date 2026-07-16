import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Unified quiet status chips — no high-chroma fills.
 * Used for NEW / Beta / Deprecated / Archived and semantic UI states.
 */
const statusBadgeVariants = cva(
  'h-5 border-transparent px-1.5 text-[10px] font-medium tracking-wide',
  {
    variants: {
      status: {
        default: 'bg-muted/70 text-muted-foreground',
        muted: 'bg-muted/50 text-muted-foreground/80',
        new: 'bg-muted/70 text-foreground/70 tracking-wider uppercase',
        beta: 'bg-muted/60 text-muted-foreground normal-case',
        deprecated: 'bg-muted/50 text-muted-foreground/75 normal-case',
        archived:
          'bg-transparent text-muted-foreground/65 normal-case ring-1 ring-border/80',
        success: 'bg-muted/70 text-muted-foreground',
        warning: 'bg-muted/70 text-muted-foreground',
        danger: 'bg-muted/70 text-muted-foreground',
        info: 'bg-muted/70 text-muted-foreground',
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
