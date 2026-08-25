import {
  Activity,
  AppWindow,
  Building2,
  HeartPulse,
  Monitor,
  Package,
  RadioTower,
  Settings,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Tablet,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'

import { PLATFORM_ICON, PLATFORM_TONE } from '@/features/applications/platform-meta'
import type {
  Application,
  ApplicationIconColor,
  ApplicationIconKey,
} from '@/types/application'

export const APPLICATION_ICON_OPTIONS: Array<{
  key: ApplicationIconKey
  icon: LucideIcon
}> = [
  { key: 'auto', icon: WandSparkles },
  { key: 'monitor', icon: Monitor },
  { key: 'smartphone', icon: Smartphone },
  { key: 'tablet', icon: Tablet },
  { key: 'heart-pulse', icon: HeartPulse },
  { key: 'stethoscope', icon: Stethoscope },
  { key: 'shield', icon: ShieldCheck },
  { key: 'package', icon: Package },
  { key: 'radio', icon: RadioTower },
  { key: 'building', icon: Building2 },
  { key: 'activity', icon: Activity },
  { key: 'settings', icon: Settings },
]

export const APPLICATION_ICON_COLORS: ApplicationIconColor[] = [
  'auto',
  'mint',
  'blue',
  'violet',
  'rose',
  'amber',
  'orange',
  'slate',
  'cyan',
  'lime',
]

export const APPLICATION_ICON_COLOR_TONE: Record<
  Exclude<ApplicationIconColor, 'auto'>,
  string
> = {
  mint: 'bg-emerald-500/[0.14] text-emerald-800 dark:bg-emerald-400/[0.16] dark:text-emerald-200',
  blue: 'bg-blue-500/[0.14] text-blue-800 dark:bg-blue-400/[0.16] dark:text-blue-200',
  violet:
    'bg-violet-500/[0.14] text-violet-800 dark:bg-violet-400/[0.16] dark:text-violet-200',
  rose: 'bg-rose-500/[0.14] text-rose-800 dark:bg-rose-400/[0.16] dark:text-rose-200',
  amber:
    'bg-amber-500/[0.16] text-amber-900 dark:bg-amber-400/[0.16] dark:text-amber-100',
  orange:
    'bg-orange-500/[0.15] text-orange-900 dark:bg-orange-400/[0.16] dark:text-orange-100',
  slate:
    'bg-slate-500/[0.14] text-slate-800 dark:bg-slate-400/[0.16] dark:text-slate-200',
  cyan: 'bg-cyan-500/[0.14] text-cyan-900 dark:bg-cyan-400/[0.16] dark:text-cyan-100',
  lime: 'bg-lime-500/[0.16] text-lime-900 dark:bg-lime-400/[0.16] dark:text-lime-100',
}

const ICON_BY_KEY: Record<Exclude<ApplicationIconKey, 'auto'>, LucideIcon> = {
  monitor: Monitor,
  smartphone: Smartphone,
  tablet: Tablet,
  'heart-pulse': HeartPulse,
  stethoscope: Stethoscope,
  shield: ShieldCheck,
  package: Package,
  radio: RadioTower,
  building: Building2,
  activity: Activity,
  settings: Settings,
}

export function resolveApplicationIcon(
  application: Pick<Application, 'platform' | 'iconKey'>,
) {
  return application.iconKey && application.iconKey !== 'auto'
    ? ICON_BY_KEY[application.iconKey]
    : (PLATFORM_ICON[application.platform] ?? AppWindow)
}

export function resolveApplicationIconTone(
  application: Pick<Application, 'platform' | 'iconColor'>,
) {
  return application.iconColor && application.iconColor !== 'auto'
    ? APPLICATION_ICON_COLOR_TONE[application.iconColor]
    : PLATFORM_TONE[application.platform]
}
