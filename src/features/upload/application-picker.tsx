import { Pin, Search, Clock, Plus } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useApplicationCatalog } from '@/features/applications/use-applications'
import { PINNED_APP_IDS, RECENT_APP_IDS } from '@/features/upload/upload-meta'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'

interface ApplicationPickerProps {
  value: string
  onChange: (id: string) => void
  className?: string
}

/** Small gap between picker bottom and fixed upload footer. */
const FOOTER_GAP_PX = 12
const MIN_SHELL_PX = 200

function AppRow({
  app,
  selected,
  onSelect,
}: {
  app: Application
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const Icon = PLATFORM_ICON[app.platform]
  const initials = app.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
        'transition-[background-color,box-shadow,ring-color] duration-[var(--duration-hover)]',
        selected
          ? 'bg-foreground/[0.05] ring-1 ring-border-strong dark:bg-white/[0.06]'
          : 'hover:bg-muted/40',
      )}
      aria-pressed={selected}
      aria-label={selected ? `${app.name}, ${t('common.selected')}` : app.name}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-[11px] font-semibold text-muted-foreground">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium text-foreground">
          {app.name}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.75rem] text-muted-foreground">
          <Icon className="size-3 shrink-0 opacity-70" strokeWidth={1.75} />
          <span className="shrink-0">{t(`platform.${app.platform}`)}</span>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <span
            className="min-w-0 truncate font-mono text-[0.6875rem]"
            title={app.packageName}
          >
            {app.packageName}
          </span>
        </span>
      </span>
      {selected ? (
        <span className="size-1.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
      ) : null}
    </button>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Pin
  children: ReactNode
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 px-2.5 text-[0.6875rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
        <Icon className="size-3 opacity-70" strokeWidth={1.75} />
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}

/**
 * Measure remaining viewport from picker top down to the fixed upload footer.
 * Avoids fragile flex height chains through ContentArea / PageContainer.
 */
function usePickerShellHeight(shellRef: RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const measure = () => {
      // Use viewport coords so page scroll (if any) does not double-count padding.
      const top = shell.getBoundingClientRect().top
      const footer = document.querySelector<HTMLElement>('[data-slot="upload-footer"]')
      const bottom = footer ? footer.getBoundingClientRect().top : window.innerHeight
      const next = Math.floor(bottom - top - FOOTER_GAP_PX)
      setHeight((prev) => {
        const h = Math.max(MIN_SHELL_PX, next)
        return prev === h ? prev : h
      })
    }

    measure()
    // Second pass after paint — top padding / fonts can shift top by a few px.
    const raf = window.requestAnimationFrame(measure)

    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('scroll', measure)

    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement)
    const parent = shell.parentElement
    if (parent) ro.observe(parent)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [shellRef])

  return height
}

export function ApplicationPicker({
  value,
  onChange,
  className,
}: ApplicationPickerProps) {
  const { t } = useTranslation()
  const shellRef = useRef<HTMLDivElement>(null)
  const shellHeight = usePickerShellHeight(shellRef)
  const [query, setQuery] = useState('')
  const { catalog } = useApplicationCatalog()

  const filtered = (() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q),
    )
  })()

  const pinned = PINNED_APP_IDS.map((id) => filtered.find((a) => a.id === id)).filter(
    Boolean,
  ) as Application[]

  const pinnedSet = new Set(PINNED_APP_IDS)
  const recent = RECENT_APP_IDS.map((id) => filtered.find((a) => a.id === id)).filter(
    (a): a is Application => Boolean(a) && !pinnedSet.has(a!.id),
  )

  const hide = new Set([...PINNED_APP_IDS, ...RECENT_APP_IDS])
  const rest = filtered.filter((a) => !hide.has(a.id))

  const showGrouped = !query.trim()

  return (
    <div
      ref={shellRef}
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl ring-1 ring-border/60 dark:ring-border',
        className,
      )}
      style={shellHeight != null ? { height: shellHeight } : undefined}
    >
      <div className="relative shrink-0 border-b border-border/50">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('upload.searchApps')}
          aria-label={t('upload.searchAppsAria')}
          className={cn(
            'h-10 w-full bg-transparent pr-3 pl-10 text-[0.875rem] outline-none',
            'placeholder:text-muted-foreground/70',
            'focus-visible:bg-muted/20',
          )}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-2 [scrollbar-gutter:stable]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
            <p className="text-[0.8125rem] text-muted-foreground">
              {query.trim() ? t('upload.noMatch', { query }) : t('upload.noAppsYet')}
            </p>
            <Link
              to="/applications/new"
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5',
                'text-[0.8125rem] font-medium text-foreground',
                'ring-1 ring-border/60 transition-colors duration-[var(--duration-hover)]',
                'hover:bg-muted/50',
              )}
            >
              <Plus className="size-3.5 opacity-70" strokeWidth={1.75} />
              {t('upload.createApplication')}
            </Link>
          </div>
        ) : showGrouped ? (
          <>
            {pinned.length > 0 ? (
              <Section title={t('upload.pinned')} icon={Pin}>
                {pinned.map((app) => (
                  <AppRow
                    key={app.id}
                    app={app}
                    selected={value === app.id}
                    onSelect={() => onChange(app.id)}
                  />
                ))}
              </Section>
            ) : null}
            {recent.length > 0 ? (
              <Section title={t('upload.recent')} icon={Clock}>
                {recent.map((app) => (
                  <AppRow
                    key={app.id}
                    app={app}
                    selected={value === app.id}
                    onSelect={() => onChange(app.id)}
                  />
                ))}
              </Section>
            ) : null}
            {rest.length > 0 ? (
              <Section title={t('upload.allApps')} icon={Search}>
                {rest.map((app) => (
                  <AppRow
                    key={app.id}
                    app={app}
                    selected={value === app.id}
                    onSelect={() => onChange(app.id)}
                  />
                ))}
              </Section>
            ) : null}
          </>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((app) => (
              <AppRow
                key={app.id}
                app={app}
                selected={value === app.id}
                onSelect={() => onChange(app.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
