import { LayoutGrid, LayoutTemplate, Palette, Upload } from 'lucide-react'

import type { SidebarNavGroup } from './types'

/** Product + foundation navigation. No Dashboard entry. */
export function getProductNavGroups(pathname: string): SidebarNavGroup[] {
  const isApps =
    pathname === '/' ||
    (pathname.startsWith('/applications') && !pathname.includes('upload'))

  return [
    {
      id: 'product',
      label: 'Product',
      items: [
        {
          id: 'applications',
          label: 'Applications',
          href: '/',
          icon: LayoutGrid,
          active: isApps,
        },
        {
          id: 'upload',
          label: 'Upload',
          href: '/upload',
          icon: Upload,
          active: pathname.startsWith('/upload'),
        },
      ],
    },
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
