import { Pin, Search, Clock } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { PINNED_APP_IDS, RECENT_APP_IDS } from '@/features/upload/upload-meta'
import { cn } from '@/lib/utils'
import { useApplicationsStore } from '@/store/applications-store'
import type { Application } from '@/types/application'

interface ApplicationPickerProps {
  value: string
  onChange: (id: string) => void
}

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

export function ApplicationPicker({ value, onChange }: ApplicationPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const created = useApplicationsStore((s) => s.created)
  const overrides = useApplicationsStore((s) => s.overrides)
  const deletedIds = useApplicationsStore((s) => s.deletedIds)
  const getCatalog = useApplicationsStore((s) => s.getCatalog)
  const catalog = useMemo(
    () => getCatalog(),
    [created, overrides, deletedIds, getCatalog],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q),
    )
  }, [query, catalog])

  const pinned = useMemo(
    () =>
      PINNED_APP_IDS.map((id) => filtered.find((a) => a.id === id)).filter(
        Boolean,
      ) as Application[],
    [filtered],
  )

  const recent = useMemo(() => {
    const pinnedSet = new Set(PINNED_APP_IDS)
    return RECENT_APP_IDS.map((id) => filtered.find((a) => a.id === id)).filter(
      (a): a is Application => Boolean(a) && !pinnedSet.has(a!.id),
    )
  }, [filtered])

  const rest = useMemo(() => {
    const hide = new Set([...PINNED_APP_IDS, ...RECENT_APP_IDS])
    return filtered.filter((a) => !hide.has(a.id))
  }, [filtered])

  const showGrouped = !query.trim()

  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-border/60 dark:ring-border">
      <div className="relative border-b border-border/50">
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
            'h-12 w-full bg-transparent pr-3 pl-10 text-[0.875rem] outline-none',
            'placeholder:text-muted-foreground/70',
            'focus-visible:bg-muted/20',
          )}
        />
      </div>

      <div className="max-h-[min(32rem,58vh)] space-y-5 overflow-y-auto p-2 [scrollbar-gutter:stable]">
        {filtered.length === 0 ? (
          <p className="px-3 py-10 text-center text-[0.8125rem] text-muted-foreground">
            {t('upload.noMatch', { query })}
          </p>
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
