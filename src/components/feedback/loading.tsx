import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface LoadingProps {
  label?: string
  className?: string
  /** Prefer skeleton for page loads; use spinner for local busy states */
  size?: 'sm' | 'md'
}

export function Loading({ label = '加载中…', className, size = 'md' }: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-muted-foreground',
        className,
      )}
    >
      <Loader2
        className={cn('animate-spin', size === 'sm' ? 'size-4' : 'size-6')}
        aria-hidden
      />
      {label ? <span className="text-caption">{label}</span> : null}
    </div>
  )
}
