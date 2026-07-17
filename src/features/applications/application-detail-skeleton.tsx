import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function ApplicationDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-8', className)} aria-hidden>
      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
        <div className="flex gap-4">
          <Skeleton className="size-16 rounded-2xl sm:size-[4.5rem]" />
          <div className="space-y-2.5 pt-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          {/* Match detail header buttons: default h-9 + primary */}
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <Skeleton className="h-24 w-full rounded-2xl" />

      <div className="space-y-4">
        <Skeleton className="h-8 w-72 rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
