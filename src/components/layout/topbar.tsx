import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

import { ThemeSwitch } from './theme-switch'
import type { BreadcrumbItem } from './types'

interface TopbarProps {
  logo?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  /** Kept for API compat; Applications home uses in-page search */
  showSearch?: boolean
  onSearchClick?: () => void
  leading?: ReactNode
  className?: string
  trailing?: ReactNode
}

/**
 * Minimal chrome: Breadcrumb · Theme · Avatar.
 * No search, stats, notifications, or help.
 */
export function Topbar({ logo, breadcrumbs, leading, className, trailing }: TopbarProps) {
  return (
    <header
      data-slot="topbar"
      className={cn(
        'sticky top-0 z-30 flex h-[var(--topbar-height)] shrink-0 items-center gap-3',
        'border-b border-border/80 bg-background/80 px-[var(--page-padding-x)] backdrop-blur-md',
        'dark:border-border dark:bg-background/75',
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
                      <li aria-hidden className="text-[0.75rem] text-muted-foreground/50">
                        /
                      </li>
                    ) : null}
                    <li className="min-w-0">
                      {item.href && !isLast ? (
                        <Link
                          to={item.href}
                          className="text-[0.8125rem] text-muted-foreground transition-colors duration-[var(--duration-hover)] hover:text-foreground"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            'block truncate text-[0.8125rem]',
                            isLast
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground',
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

      <div className="flex shrink-0 items-center gap-0.5">
        <ThemeSwitch compact />
        {trailing}
        <Avatar size="sm" className="ml-1 size-7">
          <AvatarFallback className="text-[11px] font-medium">U</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
