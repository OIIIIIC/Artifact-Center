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
