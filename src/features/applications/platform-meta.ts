import { AppWindow, Package, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { ApplicationPlatform } from '@/types/application'

export const PLATFORM_LABEL: Record<ApplicationPlatform, string> = {
  android: 'Android',
  windows: 'Windows',
  linux: 'Linux',
}

export const PLATFORM_ICON: Record<ApplicationPlatform, LucideIcon> = {
  android: Smartphone,
  windows: AppWindow,
  linux: Package,
}

/**
 * Soft platform tints for app icons — readable, not neon.
 * Prefer these over saturated gradients on list cards.
 */
export const PLATFORM_TONE: Record<ApplicationPlatform, string> = {
  android:
    'bg-emerald-500/[0.12] text-emerald-800/85 dark:bg-emerald-400/[0.12] dark:text-emerald-200/85',
  windows:
    'bg-sky-500/[0.12] text-sky-900/80 dark:bg-sky-400/[0.12] dark:text-sky-200/85',
  linux:
    'bg-amber-500/[0.12] text-amber-900/80 dark:bg-amber-400/[0.12] dark:text-amber-100/85',
}
