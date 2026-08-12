import { LayoutGrid, Settings } from 'lucide-react'

import i18n from '@/i18n'
import type { SidebarNavGroup } from './types'

/** 日常产品导航仅呈现用户完成制品管理所需的对象入口。 */
export function getProductNavGroups(
  pathname: string,
  _options: { isAdmin?: boolean } = {},
): SidebarNavGroup[] {
  const t = i18n.t.bind(i18n)
  const isApps = pathname === '/' || pathname.startsWith('/applications')

  const groups: SidebarNavGroup[] = [
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
          id: 'settings',
          label: t('nav.settings'),
          href: '/settings',
          icon: Settings,
          active: pathname.startsWith('/settings'),
        },
      ],
    },
  ]

  return groups
}
