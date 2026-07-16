import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva('border-transparent', {
  variants: {
    status: {
      default: 'bg-secondary text-secondary-foreground',
      success: 'bg-success/15 text-success-foreground dark:text-success',
      warning: 'bg-warning/20 text-warning-foreground dark:text-warning',
      danger: 'bg-destructive/10 text-destructive',
      info: 'bg-info/15 text-info-foreground dark:text-info',
      muted: 'bg-muted text-muted-foreground',
    },
  },
  defaultVariants: {
    status: 'default',
  },
})

export interface StatusBadgeProps
  extends ComponentProps<'span'>, VariantProps<typeof statusBadgeVariants> {}

/**
 * Semantic status badge — colors only for meaning (docs/08).
 */
export function StatusBadge({ className, status, ...props }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    />
  )
}
