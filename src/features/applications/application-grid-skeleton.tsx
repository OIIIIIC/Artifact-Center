import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ApplicationGridSkeletonProps {
  count?: number
  className?: string
}

export function ApplicationGridSkeleton({
  count = 8,
  className,
}: ApplicationGridSkeletonProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4',
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex h-full flex-col rounded-2xl bg-card/80 p-5 ring-1 ring-border/70 dark:bg-card/60"
        >
          <div className="flex items-start gap-3.5">
            <Skeleton className="size-12 shrink-0 rounded-[14px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
          <div className="mt-4 flex gap-1.5">
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-5 w-12 rounded-md" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="mt-5 flex items-center justify-between pt-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
