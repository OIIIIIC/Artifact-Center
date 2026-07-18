import { LayoutGrid, Settings, Users } from 'lucide-react'

import i18n from '@/i18n'
import type { SidebarNavGroup } from './types'

/** 日常产品导航仅呈现用户完成制品管理所需的对象入口。 */
export function getProductNavGroups(
  pathname: string,
  options: { isAdmin?: boolean } = {},
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
          id: 'members',
          label: t('nav.members'),
          href: '/members',
          icon: Users,
          active: pathname.startsWith('/members'),
          disabled: !options.isAdmin,
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

  groups[0].items = groups[0].items.filter((item) => !item.disabled)

  return groups
}
