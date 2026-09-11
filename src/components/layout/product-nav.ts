import { Box, LayoutGrid, Settings, Sparkles } from 'lucide-react'

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
      label: t('directory.workspace'),
      items: [
        {
          id: 'workspace',
          label: t('nav.workspace'),
          href: '/workspace',
          icon: Sparkles,
          active: pathname.startsWith('/workspace'),
        },
        {
          id: 'applications',
          label: t('nav.applications'),
          href: '/',
          icon: LayoutGrid,
          active: isApps,
        },
      ],
    },
  ]

  groups.push({
    id: 'management',
    label: t('directory.management'),
    items: [
      ...(options.isAdmin
        ? [
            {
              id: 'products',
              label: t('directory.manageProducts'),
              href: '/products',
              icon: Box,
              active: pathname === '/products' || pathname === '/regions',
            },
          ]
        : []),
      {
        id: 'settings',
        label: t('nav.settings'),
        href: '/settings',
        icon: Settings,
        active: pathname.startsWith('/settings'),
      },
    ],
  })

  return groups
}
