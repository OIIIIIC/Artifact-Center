import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type SidebarNavItem = {
  id: string
  label: string
  href?: string
  icon?: LucideIcon
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

export type SidebarNavGroup = {
  id: string
  label?: string
  items: SidebarNavItem[]
}

export type BreadcrumbItem = {
  label: string
  href?: string
}

export type LayoutSlot = ReactNode
