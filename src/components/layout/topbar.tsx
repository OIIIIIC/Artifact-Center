import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useModKeyLabel } from '@/hooks/use-mod-key-label'
import { cn } from '@/lib/utils'

import { LocaleSwitch } from './locale-switch'
import { ThemeSwitch } from './theme-switch'
import { UserMenu } from './user-menu'
import type { BreadcrumbItem } from './types'

interface TopbarProps {
  logo?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  showSearch?: boolean
  onSearchClick?: () => void
  leading?: ReactNode
  className?: string
  trailing?: ReactNode
}

/**
 * Minimal chrome: Search · Breadcrumb · Locale · Theme · Avatar.
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
  const { t } = useTranslation()
  const shortcut = useModKeyLabel('K')

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
          <nav aria-label={t('common.breadcrumb')} className="min-w-0">
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
                    <li className={cn('min-w-0', isLast ? 'flex-1' : 'shrink-0')}>
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
                          title={item.label}
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
        {showSearch && onSearchClick ? (
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'gap-2 px-2.5 text-muted-foreground',
              'transition-colors duration-[var(--duration-hover)]',
              'hover:text-foreground sm:px-3',
            )}
            onClick={onSearchClick}
            aria-label={t('search.openAria', { shortcut })}
          >
            <Search className="size-4" strokeWidth={1.75} />
            <span className="hidden text-[0.8125rem] sm:inline">{t('search.open')}</span>
            <kbd className="hidden rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground md:inline">
              {shortcut}
            </kbd>
          </Button>
        ) : null}
        <LocaleSwitch compact />
        <ThemeSwitch compact />
        {trailing}
        <UserMenu />
      </div>
    </header>
  )
}
