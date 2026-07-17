import type { ApplicationStatus } from '@/types/application'

/**
 * Lifecycle palette — aligned with StatusBadge semantics.
 * Quiet tints (not ERP rainbow): emerald / sky / violet / amber / stone.
 */
export const APPLICATION_STATUS_CHIP: Record<
  ApplicationStatus,
  {
    /** Soft surface when not selected */
    idle: string
    /** Stronger fill + ring when selected */
    selected: string
    /** Leading status dot */
    dot: string
    /** Maps to StatusBadge `status` prop */
    badge: 'success' | 'new' | 'beta' | 'deprecated' | 'archived' | 'default'
  }
> = {
  active: {
    idle: 'bg-emerald-500/[0.07] text-emerald-900/75 hover:bg-emerald-500/[0.12] dark:bg-emerald-400/10 dark:text-emerald-200/85 dark:hover:bg-emerald-400/15',
    selected:
      'bg-emerald-500/15 text-emerald-950 ring-1 ring-emerald-500/35 dark:bg-emerald-400/20 dark:text-emerald-100 dark:ring-emerald-400/40',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    badge: 'success',
  },
  new: {
    idle: 'bg-teal-500/[0.08] text-teal-900/75 hover:bg-teal-500/[0.13] dark:bg-teal-400/10 dark:text-teal-200/85 dark:hover:bg-teal-400/15',
    selected:
      'bg-teal-500/16 text-teal-950 ring-1 ring-teal-500/35 dark:bg-teal-400/20 dark:text-teal-100 dark:ring-teal-400/40',
    dot: 'bg-teal-500 dark:bg-teal-400',
    badge: 'new',
  },
  beta: {
    idle: 'bg-violet-500/[0.08] text-violet-900/75 hover:bg-violet-500/[0.13] dark:bg-violet-400/10 dark:text-violet-200/85 dark:hover:bg-violet-400/15',
    selected:
      'bg-violet-500/16 text-violet-950 ring-1 ring-violet-500/35 dark:bg-violet-400/20 dark:text-violet-100 dark:ring-violet-400/40',
    dot: 'bg-violet-500 dark:bg-violet-400',
    badge: 'beta',
  },
  deprecated: {
    idle: 'bg-amber-500/[0.09] text-amber-950/75 hover:bg-amber-500/[0.14] dark:bg-amber-400/10 dark:text-amber-200/85 dark:hover:bg-amber-400/15',
    selected:
      'bg-amber-500/18 text-amber-950 ring-1 ring-amber-500/40 dark:bg-amber-400/20 dark:text-amber-100 dark:ring-amber-400/40',
    dot: 'bg-amber-500 dark:bg-amber-400',
    badge: 'deprecated',
  },
  archived: {
    idle: 'bg-stone-500/[0.08] text-stone-700/80 hover:bg-stone-500/[0.12] dark:bg-stone-400/10 dark:text-stone-300/85 dark:hover:bg-stone-400/15',
    selected:
      'bg-stone-500/14 text-stone-900 ring-1 ring-stone-400/40 dark:bg-stone-400/18 dark:text-stone-100 dark:ring-stone-500/40',
    dot: 'bg-stone-500 dark:bg-stone-400',
    badge: 'archived',
  },
}

/** StatusBadge variant for application lifecycle (cards / headers). */
export function applicationStatusBadge(
  status: ApplicationStatus,
): 'success' | 'new' | 'beta' | 'deprecated' | 'archived' | 'default' | null {
  if (status === 'active') return null // healthy apps omit chip on cards
  return APPLICATION_STATUS_CHIP[status].badge
}
