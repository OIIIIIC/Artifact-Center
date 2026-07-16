import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

import type { SidebarNavGroup, SidebarNavItem } from './types'

interface SidebarProps {
  logo?: ReactNode
  groups: SidebarNavGroup[]
  footer?: ReactNode
  className?: string
  /**
   * Collapse reserved for future (Linear-style rail).
   * Prop accepted so callers can wire later without API break.
   */
  collapsed?: boolean
}

/**
 * Product navigation rail — Linear / GitHub Desktop calm density.
 * Width token: --sidebar-width (256px). Collapse not implemented yet.
 */
export function Sidebar({
  logo,
  groups,
  footer,
  className,
  collapsed = false,
}: SidebarProps) {
  return (
    <aside
      data-slot="sidebar"
      data-collapsed={collapsed || undefined}
      className={cn(
        'flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className,
      )}
    >
      <div
        data-slot="sidebar-logo"
        className="flex h-[var(--topbar-height)] shrink-0 items-center border-b border-sidebar-border px-[var(--sidebar-padding-x)]"
      >
        {logo}
      </div>

      <nav
        className="flex-1 space-y-6 overflow-y-auto px-[var(--sidebar-padding-x)] py-4"
        aria-label="主导航"
      >
        {groups.map((group) => (
          <SidebarGroup key={group.id} group={group} />
        ))}
      </nav>

      {footer ? (
        <div className="shrink-0 border-t border-sidebar-border px-[var(--sidebar-padding-x)] py-3">
          {footer}
        </div>
      ) : null}
    </aside>
  )
}

function SidebarGroup({ group }: { group: SidebarNavGroup }) {
  return (
    <div data-slot="sidebar-group" className="space-y-1">
      {group.label ? (
        <p className="text-label mb-2 px-2.5 text-muted-foreground/80">{group.label}</p>
      ) : null}
      <ul className="space-y-0.5">
        {group.items.map((item) => (
          <li key={item.id}>
            <SidebarItem item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SidebarItem({ item }: { item: SidebarNavItem }) {
  const Icon = item.icon as LucideIcon | undefined
  const base = cn(
    'group/nav flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-title',
    'transition-colors duration-hover ease-standard',
    'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50',
    item.disabled && 'pointer-events-none opacity-40',
    item.active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
  )

  const content = (
    <>
      {Icon ? (
        <Icon
          className={cn(
            'size-4 shrink-0 stroke-[1.75]',
            item.active
              ? 'text-sidebar-foreground'
              : 'text-muted-foreground group-hover/nav:text-sidebar-foreground',
          )}
          aria-hidden
        />
      ) : null}
      <span className="truncate">{item.label}</span>
    </>
  )

  if (item.href && !item.disabled) {
    return (
      <Link
        to={item.href}
        className={base}
        aria-current={item.active ? 'page' : undefined}
        onClick={item.onClick}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={cn(base, 'text-left')}
      disabled={item.disabled}
      aria-current={item.active ? 'page' : undefined}
      onClick={item.onClick}
    >
      {content}
    </button>
  )
}

export function SidebarBrand({
  title = 'Artifact Center',
  subtitle,
  href = '/',
}: {
  title?: string
  subtitle?: string
  href?: string
}) {
  return (
    <Link
      to={href}
      className="flex min-w-0 flex-col transition-opacity duration-hover hover:opacity-80"
    >
      <span className="text-title truncate text-sidebar-foreground">{title}</span>
      {subtitle ? (
        <span className="text-caption truncate text-muted-foreground">{subtitle}</span>
      ) : null}
    </Link>
  )
}
