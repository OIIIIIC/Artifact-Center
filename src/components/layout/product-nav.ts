import { LayoutGrid, LayoutTemplate, Palette, Settings, Upload } from 'lucide-react'

import i18n from '@/i18n'
import type { SidebarNavGroup } from './types'

/** Product + foundation navigation. Labels via i18n (default zh-CN). */
export function getProductNavGroups(pathname: string): SidebarNavGroup[] {
  const t = i18n.t.bind(i18n)
  const isApps = pathname === '/' || pathname.startsWith('/applications')

  return [
    {
      id: 'product',
      label: t('nav.product'),
      items: [
        {
          id: 'applications',
          label: t('nav.applications'),
          href: '/',
          icon: LayoutGrid,
          active: isApps,
        },
        {
          id: 'upload',
          label: t('nav.upload'),
          href: '/upload',
          icon: Upload,
          active: pathname.startsWith('/upload'),
        },
        {
          id: 'settings',
          label: t('nav.settings'),
          href: '/settings',
          icon: Settings,
          active: pathname.startsWith('/settings'),
        },
      ],
    },
    {
      id: 'foundation',
      label: t('nav.foundation'),
      items: [
        {
          id: 'design-system',
          label: t('nav.designSystem'),
          href: '/design-system',
          icon: Palette,
          active: pathname.startsWith('/design-system'),
        },
        {
          id: 'layout',
          label: t('nav.layout'),
          href: '/layout',
          icon: LayoutTemplate,
          active: pathname.startsWith('/layout'),
        },
      ],
    },
  ]
}
