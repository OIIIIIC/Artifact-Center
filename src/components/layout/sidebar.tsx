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
  collapsed?: boolean
}

/**
 * Linear / Raycast-like rail — weak groups, restrained active, no admin block.
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
        'flex h-full w-[var(--sidebar-width)] shrink-0 flex-col bg-sidebar text-sidebar-foreground',
        'border-r border-sidebar-border/60',
        className,
      )}
    >
      <div
        data-slot="sidebar-logo"
        className="flex h-[var(--topbar-height)] shrink-0 items-center px-4"
      >
        {logo}
      </div>

      <nav className="flex-1 space-y-8 overflow-y-auto px-3 pb-4 pt-2" aria-label="Main">
        {groups.map((group) => (
          <SidebarGroup key={group.id} group={group} />
        ))}
      </nav>

      {footer ? <div className="shrink-0 px-3 py-3">{footer}</div> : null}
    </aside>
  )
}

function SidebarGroup({ group }: { group: SidebarNavGroup }) {
  return (
    <div data-slot="sidebar-group">
      {group.label ? (
        <p className="mb-1.5 px-2.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground/55 uppercase">
          {group.label}
        </p>
      ) : null}
      <ul className="space-y-px">
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
    'group/nav flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px]',
    'text-[13px] transition-[color,background-color] duration-[var(--duration-hover)] ease-standard',
    'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/35',
    item.disabled && 'pointer-events-none opacity-40',
    item.active
      ? 'font-medium text-foreground'
      : 'font-normal text-muted-foreground/85 hover:text-foreground',
  )

  const content = (
    <>
      {Icon ? (
        <Icon
          className={cn(
            'size-[15px] shrink-0 stroke-[1.5] transition-colors duration-[var(--duration-hover)]',
            item.active
              ? 'text-foreground'
              : 'text-muted-foreground/65 group-hover/nav:text-foreground/80',
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
        className={cn(
          base,
          item.active
            ? 'bg-foreground/[0.04] dark:bg-white/[0.04]'
            : 'hover:bg-foreground/[0.03] dark:hover:bg-white/[0.03]',
        )}
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
      className={cn(
        base,
        'text-left',
        item.active
          ? 'bg-foreground/[0.04] dark:bg-white/[0.04]'
          : 'hover:bg-foreground/[0.03] dark:hover:bg-white/[0.03]',
      )}
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
      className="flex min-w-0 items-center gap-2.5 transition-opacity duration-[var(--duration-hover)] hover:opacity-75"
    >
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground text-[10px] font-semibold tracking-tight text-background"
        aria-hidden
      >
        AC
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">
          {title}
        </span>
        {subtitle ? (
          <span className="block truncate text-[11px] text-muted-foreground/70">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
