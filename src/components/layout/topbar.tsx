import { Search } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ThemeSwitch } from './theme-switch'
import type { BreadcrumbItem } from './types'

interface TopbarProps {
  /** Optional mark when Sidebar is hidden (e.g. mobile / blank shells) */
  logo?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  /** Search is placeholder only in layout foundation */
  showSearch?: boolean
  onSearchClick?: () => void
  /** Mobile: open navigation drawer */
  leading?: ReactNode
  className?: string
  /** Extra right-side slots (keep empty in product; playground may pass none) */
  trailing?: ReactNode
}

/**
 * Product top chrome — not an Admin dashboard bar.
 * Allowed: logo(opt) · breadcrumb · search placeholder · theme · avatar placeholder.
 * Forbidden: stats, notifications, messages, help widgets.
 */
export function Topbar({
  logo,
  breadcrumbs,
  showSearch = true,
  onSearchClick,
  leading,
  className,
  trailing,
}: TopbarProps) {
  return (
    <header
      data-slot="topbar"
      className={cn(
        'sticky top-0 z-30 flex h-[var(--topbar-height)] shrink-0 items-center gap-3 border-b border-border bg-background/90 px-[var(--page-padding-x)] backdrop-blur-sm',
        className,
      )}
    >
      {leading ? <div className="shrink-0 lg:hidden">{leading}</div> : null}

      {logo ? <div className="mr-2 shrink-0">{logo}</div> : null}

      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <Fragment key={`${item.label}-${index}`}>
                    {index > 0 ? (
                      <li aria-hidden className="text-caption text-muted-foreground/60">
                        /
                      </li>
                    ) : null}
                    <li className="min-w-0">
                      {item.href && !isLast ? (
                        <Link
                          to={item.href}
                          className="text-caption text-muted-foreground transition-colors duration-hover hover:text-foreground"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            'text-caption block truncate',
                            isLast ? 'text-foreground' : 'text-muted-foreground',
                          )}
                          aria-current={isLast ? 'page' : undefined}
                        >
                          {item.label}
                        </span>
                      )}
                    </li>
                  </Fragment>
                )
              })}
            </ol>
          </nav>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {showSearch ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSearchClick}
            className="hidden h-9 gap-2 border-border bg-surface px-3 text-muted-foreground transition-colors duration-hover hover:bg-surface-muted hover:text-foreground sm:inline-flex"
          >
            <Search className="size-3.5" strokeWidth={1.75} />
            <span className="text-caption">搜索</span>
            <kbd className="text-caption ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
              ⌘K
            </kbd>
          </Button>
        ) : null}

        {showSearch ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground sm:hidden"
            onClick={onSearchClick}
            aria-label="搜索"
          >
            <Search className="size-4" strokeWidth={1.75} />
          </Button>
        ) : null}

        <ThemeSwitch compact />

        {trailing}

        <Avatar size="sm" className="ml-0.5">
          <AvatarFallback className="text-caption">U</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
