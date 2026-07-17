import type { UploadChannel } from '@/types/upload'

/**
 * Channel chips — clear selected vs idle.
 * Idle stays neutral; color only when selected (avoids multi-select look).
 */
export const CHANNEL_CHIP: Record<
  UploadChannel,
  {
    idle: string
    selected: string
    /** Leading status dot */
    dot: string
    /** Dot when not selected — muted */
    dotIdle: string
  }
> = {
  stable: {
    idle: 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    selected:
      'bg-sky-500/14 text-sky-950 ring-1 ring-sky-500/35 dark:bg-sky-400/18 dark:text-sky-100 dark:ring-sky-400/40',
    dot: 'bg-sky-500 dark:bg-sky-400',
    dotIdle: 'bg-muted-foreground/40',
  },
  beta: {
    idle: 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    selected:
      'bg-violet-500/14 text-violet-950 ring-1 ring-violet-500/35 dark:bg-violet-400/18 dark:text-violet-100 dark:ring-violet-400/40',
    dot: 'bg-violet-500 dark:bg-violet-400',
    dotIdle: 'bg-muted-foreground/40',
  },
  internal: {
    idle: 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    selected:
      'bg-stone-500/14 text-stone-900 ring-1 ring-stone-400/40 dark:bg-stone-400/18 dark:text-stone-100 dark:ring-stone-500/40',
    dot: 'bg-stone-500 dark:bg-stone-400',
    dotIdle: 'bg-muted-foreground/40',
  },
  deprecated: {
    idle: 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    selected:
      'bg-amber-500/16 text-amber-950 ring-1 ring-amber-500/40 dark:bg-amber-400/18 dark:text-amber-100 dark:ring-amber-400/40',
    dot: 'bg-amber-500 dark:bg-amber-400',
    dotIdle: 'bg-muted-foreground/40',
  },
}

/** Compact badge classes for review / lists */
export const CHANNEL_BADGE: Record<UploadChannel, string> = {
  stable: 'bg-sky-500/12 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200',
  beta: 'bg-violet-500/12 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300',
  internal: 'bg-stone-500/10 text-stone-700 dark:bg-stone-400/15 dark:text-stone-300',
  deprecated: 'bg-amber-500/12 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
}
