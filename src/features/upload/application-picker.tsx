import { Pin, Search, Clock } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { MOCK_APPLICATIONS } from '@/mocks/applications'
import { PINNED_APP_IDS, RECENT_APP_IDS } from '@/features/upload/upload-meta'
import { PLATFORM_ICON, PLATFORM_LABEL } from '@/features/applications/platform-meta'
import { cn } from '@/lib/utils'
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
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-[11px] font-semibold text-muted-foreground">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium text-foreground">
          {app.name}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
          <Icon className="size-3 opacity-70" strokeWidth={1.75} />
          {PLATFORM_LABEL[app.platform]}
          <span className="text-muted-foreground/40">·</span>
          <span className="truncate font-mono text-[0.6875rem]">{app.packageName}</span>
        </span>
      </span>
      {selected ? (
        <span className="shrink-0 text-[0.6875rem] font-medium text-foreground">
          Selected
        </span>
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
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 px-1 text-[0.6875rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
        <Icon className="size-3 opacity-70" strokeWidth={1.75} />
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}

/**
 * Modern application selector — not a native <select>.
 */
export function ApplicationPicker({ value, onChange }: ApplicationPickerProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MOCK_APPLICATIONS
    return MOCK_APPLICATIONS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q),
    )
  }, [query])

  const pinned = useMemo(
    () =>
      PINNED_APP_IDS.map((id) => filtered.find((a) => a.id === id)).filter(
        Boolean,
      ) as Application[],
    [filtered],
  )

  const recent = useMemo(
    () =>
      RECENT_APP_IDS.map((id) => filtered.find((a) => a.id === id)).filter(
        Boolean,
      ) as Application[],
    [filtered],
  )

  const rest = useMemo(() => {
    const hide = new Set([...PINNED_APP_IDS, ...RECENT_APP_IDS])
    return filtered.filter((a) => !hide.has(a.id) || query.trim())
  }, [filtered, query])

  const showGrouped = !query.trim()

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search applications…"
          aria-label="Search applications"
          className={cn(
            'h-11 w-full rounded-xl bg-muted/35 pr-3 pl-10 text-[0.875rem] outline-none',
            'ring-1 ring-border/60 placeholder:text-muted-foreground/70',
            'transition-[box-shadow,background-color] duration-[var(--duration-hover)]',
            'focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30',
          )}
        />
      </div>

      <div
        className={cn(
          'max-h-[min(28rem,55vh)] space-y-5 overflow-y-auto rounded-2xl p-2',
          'ring-1 ring-border/60 dark:ring-border',
        )}
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-10 text-center text-[0.8125rem] text-muted-foreground">
            No applications match “{query}”.
          </p>
        ) : showGrouped ? (
          <>
            {pinned.length > 0 ? (
              <Section title="Pinned" icon={Pin}>
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
              <Section title="Recent" icon={Clock}>
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
            <Section title="All applications" icon={Search}>
              {(rest.length ? rest : filtered).map((app) => (
                <AppRow
                  key={app.id}
                  app={app}
                  selected={value === app.id}
                  onSelect={() => onChange(app.id)}
                />
              ))}
            </Section>
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
