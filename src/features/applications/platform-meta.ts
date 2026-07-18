import { AppWindow, Package, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { ApplicationPlatform } from '@/types/application'

export const PLATFORM_LABEL: Record<ApplicationPlatform, string> = {
  android: 'Android',
  windows: 'Windows',
  zip: 'ZIP',
}

export const PLATFORM_ICON: Record<ApplicationPlatform, LucideIcon> = {
  android: Smartphone,
  windows: AppWindow,
  zip: Package,
}

export const PLATFORM_TONE: Record<ApplicationPlatform, string> = {
  android:
    'bg-emerald-500/[0.07] text-emerald-900/80 dark:bg-emerald-400/10 dark:text-emerald-200/80',
  windows: 'bg-sky-500/[0.07] text-sky-950/80 dark:bg-sky-400/10 dark:text-sky-200/80',
  zip: 'bg-stone-500/[0.08] text-stone-800/80 dark:bg-stone-400/10 dark:text-stone-200/80',
}
