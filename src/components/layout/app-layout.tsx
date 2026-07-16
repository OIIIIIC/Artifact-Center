import { Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ContentArea } from './content-area'
import { getProductNavGroups } from './product-nav'
import { Sidebar, SidebarBrand } from './sidebar'
import { Topbar } from './topbar'
import type { BreadcrumbItem, SidebarNavGroup } from './types'

interface AppLayoutProps {
  children: ReactNode
  className?: string
  /** Sidebar nav groups (foundation / playground use meta routes only) */
  navGroups?: SidebarNavGroup[]
  sidebarLogo?: ReactNode
  sidebarFooter?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  showSearch?: boolean
  onSearchClick?: () => void
  /** Hide sidebar rail entirely (rare) */
  hideSidebar?: boolean
  contentClassName?: string
}

/**
 * Default product shell: Sidebar + Topbar + ContentArea.
 * All future product pages compose through this layout.
 */
export function AppLayout({
  children,
  className,
  navGroups,
  sidebarLogo,
  sidebarFooter,
  breadcrumbs,
  showSearch = false,
  onSearchClick,
  hideSidebar = false,
  contentClassName,
}: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const resolvedGroups = navGroups ?? getProductNavGroups(pathname)

  const logo = sidebarLogo ?? (
    <SidebarBrand title="Artifact Center" subtitle="Internal" href="/" />
  )

  const sidebar = !hideSidebar ? (
    <Sidebar logo={logo} groups={resolvedGroups} footer={sidebarFooter} />
  ) : null

  return (
    <div
      data-slot="app-layout"
      className={cn('flex h-dvh overflow-hidden bg-background', className)}
    >
      {/* Desktop / laptop rail */}
      {!hideSidebar ? <div className="hidden h-full lg:flex">{sidebar}</div> : null}

      {/* Mobile / tablet drawer */}
      {!hideSidebar && mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-foreground/20 transition-opacity duration-modal"
            aria-label="关闭导航"
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
                    aria-label="关闭"
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
          onSearchClick={onSearchClick}
          leading={
            !hideSidebar ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setMobileOpen(true)}
                aria-label="打开导航"
              >
                <Menu className="size-4" strokeWidth={1.75} />
              </Button>
            ) : null
          }
        />
        <ContentArea className={contentClassName}>{children}</ContentArea>
      </div>
    </div>
  )
}
