import type { UploadChannel } from '@/types/upload'

/**
 * Quiet channel colors — same philosophy as StatusBadge:
 * soft tints for scanability, no neon / ERP rainbow.
 */
export const CHANNEL_CHIP: Record<
  UploadChannel,
  {
    idle: string
    selected: string
    /** Leading status dot */
    dot: string
  }
> = {
  stable: {
    idle: 'text-sky-800/80 hover:bg-sky-500/[0.08] dark:text-sky-200/85 dark:hover:bg-sky-400/12',
    selected:
      'bg-sky-500/14 text-sky-950 ring-1 ring-sky-500/30 dark:bg-sky-400/18 dark:text-sky-100 dark:ring-sky-400/35',
    dot: 'bg-sky-500 dark:bg-sky-400',
  },
  beta: {
    idle: 'text-violet-800/80 hover:bg-violet-500/[0.08] dark:text-violet-200/85 dark:hover:bg-violet-400/12',
    selected:
      'bg-violet-500/14 text-violet-950 ring-1 ring-violet-500/30 dark:bg-violet-400/18 dark:text-violet-100 dark:ring-violet-400/35',
    dot: 'bg-violet-500 dark:bg-violet-400',
  },
  internal: {
    idle: 'text-stone-700/85 hover:bg-stone-500/[0.08] dark:text-stone-300/85 dark:hover:bg-stone-400/12',
    selected:
      'bg-stone-500/12 text-stone-900 ring-1 ring-stone-400/35 dark:bg-stone-400/16 dark:text-stone-100 dark:ring-stone-500/35',
    dot: 'bg-stone-500 dark:bg-stone-400',
  },
  deprecated: {
    idle: 'text-amber-900/80 hover:bg-amber-500/[0.09] dark:text-amber-200/85 dark:hover:bg-amber-400/12',
    selected:
      'bg-amber-500/16 text-amber-950 ring-1 ring-amber-500/35 dark:bg-amber-400/18 dark:text-amber-100 dark:ring-amber-400/35',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
}

/** Compact badge classes for review / lists */
export const CHANNEL_BADGE: Record<UploadChannel, string> = {
  stable: 'bg-sky-500/12 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200',
  beta: 'bg-violet-500/12 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300',
  internal: 'bg-stone-500/10 text-stone-700 dark:bg-stone-400/15 dark:text-stone-300',
  deprecated: 'bg-amber-500/12 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
}
