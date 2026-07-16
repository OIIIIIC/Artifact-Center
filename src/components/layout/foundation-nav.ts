import { LayoutTemplate, Palette } from 'lucide-react'

import type { SidebarNavGroup } from './types'

/** Meta navigation for foundation phase only — no product modules. */
export function getFoundationNavGroups(pathname: string): SidebarNavGroup[] {
  return [
    {
      id: 'foundation',
      label: 'Foundation',
      items: [
        {
          id: 'design-system',
          label: 'Design System',
          href: '/design-system',
          icon: Palette,
          active: pathname.startsWith('/design-system'),
        },
        {
          id: 'layout',
          label: 'Layout',
          href: '/layout',
          icon: LayoutTemplate,
          active: pathname.startsWith('/layout'),
        },
      ],
    },
  ]
}
