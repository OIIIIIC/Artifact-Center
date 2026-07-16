import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PageSkeletonProps {
  className?: string
  rows?: number
}

/** Layout-isomorphic skeleton for list-like pages */
export function PageSkeleton({ className, rows = 4 }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)} aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
