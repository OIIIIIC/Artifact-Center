import { Menu, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { GlobalSearchDialog } from '@/features/search/global-search-dialog'
import { cn } from '@/lib/utils'
import { useLocaleStore } from '@/store/locale-store'

import { ContentArea } from './content-area'
import { getProductNavGroups } from './product-nav'
import { Sidebar, SidebarBrand } from './sidebar'
import { Topbar } from './topbar'
import type { BreadcrumbItem, SidebarNavGroup } from './types'

interface AppLayoutProps {
  children: ReactNode
  className?: string
  navGroups?: SidebarNavGroup[]
  sidebarLogo?: ReactNode
  sidebarFooter?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  showSearch?: boolean
  onSearchClick?: () => void
  hideSidebar?: boolean
  contentClassName?: string
}

export function AppLayout({
  children,
  className,
  navGroups,
  sidebarLogo,
  sidebarFooter,
  breadcrumbs,
  showSearch = true,
  onSearchClick,
  hideSidebar = false,
  contentClassName,
}: AppLayoutProps) {
  const { t } = useTranslation()
  // Re-render nav labels when locale changes
  useLocaleStore((s) => s.locale)

  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchSession, setSearchSession] = useState(0)
  const { pathname } = useLocation()
  const resolvedGroups = navGroups ?? getProductNavGroups(pathname)

  useEffect(() => {
    if (!showSearch) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        const editing = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
        // Allow Cmd/Ctrl+K even in inputs for global search (palette standard)
        if (editing && !(e.metaKey || e.ctrlKey)) return
        e.preventDefault()
        setSearchOpen((v) => {
          if (!v) setSearchSession((n) => n + 1)
          return !v
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSearch])

  const openSearch = () => {
    setSearchSession((n) => n + 1)
    setSearchOpen(true)
  }

  const handleSearchClick = () => {
    if (onSearchClick) onSearchClick()
    else openSearch()
  }

  const logo = sidebarLogo ?? (
    <SidebarBrand title={t('brand.name')} subtitle={t('brand.subtitle')} href="/" />
  )

  const sidebar = !hideSidebar ? (
    <Sidebar logo={logo} groups={resolvedGroups} footer={sidebarFooter} />
  ) : null

  return (
    <div
      data-slot="app-layout"
      className={cn('flex h-dvh overflow-hidden bg-background', className)}
    >
      {!hideSidebar ? <div className="hidden h-full lg:flex">{sidebar}</div> : null}

      {!hideSidebar && mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-foreground/20 transition-opacity duration-modal"
            aria-label={t('common.closeNav')}
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex shadow-md transition-transform duration-modal ease-standard">
            <Sidebar
              logo={
                <div className="flex w-full items-center justify-between gap-2">
                  {logo}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => setMobileOpen(false)}
                    aria-label={t('common.closeNav')}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              }
              groups={resolvedGroups.map((g) => ({
                ...g,
                items: g.items.map((item) => ({
                  ...item,
                  onClick: () => {
                    item.onClick?.()
                    setMobileOpen(false)
                  },
                })),
              }))}
              footer={sidebarFooter}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          breadcrumbs={breadcrumbs}
          showSearch={showSearch}
          onSearchClick={showSearch ? handleSearchClick : undefined}
          leading={
            !hideSidebar ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setMobileOpen(true)}
                aria-label={t('common.openNav')}
              >
                <Menu className="size-4" strokeWidth={1.75} />
              </Button>
            ) : null
          }
        />
        <ContentArea className={contentClassName}>{children}</ContentArea>
      </div>

      {showSearch ? (
        <GlobalSearchDialog
          key={searchSession}
          open={searchOpen}
          onOpenChange={setSearchOpen}
        />
      ) : null}
    </div>
  )
}
