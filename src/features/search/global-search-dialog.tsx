import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileBox, LayoutGrid, Search, SearchX } from 'lucide-react'

import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useServerSearch } from '@/features/search/use-server-search'
import { useModKeyLabel } from '@/hooks/use-mod-key-label'
import { cn } from '@/lib/utils'

interface GlobalSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Command-palette style global search: Applications + Artifacts, keyboard nav.
 */
export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const shortcut = useModKeyLabel('K')

  const { results } = useServerSearch(open ? query : '', {
    applications: 6,
    artifacts: 8,
  })

  const flatItems = useMemo(() => {
    return [
      ...results.applications.map((h) => ({
        key: `app-${h.application.id}`,
        kind: 'application' as const,
        href: `/applications/${h.application.id}`,
        title: h.application.name,
        subtitle: h.application.packageName,
        platform: h.application.platform,
      })),
      ...results.artifacts.map((h) => ({
        key: `art-${h.artifact.id}`,
        kind: 'artifact' as const,
        href: `/applications/${h.application.id}`,
        title: `${h.application.name} · v${h.artifact.version}`,
        subtitle: h.artifact.filename,
        platform: h.artifact.platform,
      })),
    ]
  }, [results])

  // Fresh mount when parent remounts with key; only focus input when open
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-search-index="${activeIndex}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  const go = (href: string) => {
    onOpenChange(false)
    navigate(href)
  }

  const goAll = () => {
    const q = query.trim()
    onOpenChange(false)
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flatItems.length === 0) return
      setActiveIndex((i) => (i + 1) % flatItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flatItems.length === 0) return
      setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatItems[activeIndex]) {
        go(flatItems[activeIndex].href)
      } else if (query.trim()) {
        goAll()
      }
    }
  }

  const hasQuery = query.trim().length > 0
  const empty = hasQuery && results.total === 0

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] dark:bg-foreground/40"
        aria-label={t('common.cancel')}
        onClick={() => onOpenChange(false)}
      />
      <div className="pointer-events-none absolute inset-x-0 top-[12vh] flex justify-center px-4 sm:top-[14vh]">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl',
            'bg-popover text-popover-foreground shadow-[var(--shadow-md,0_16px_48px_rgba(0,0,0,0.16))]',
            'ring-1 ring-border/70',
          )}
        >
          <div className="border-b border-border/60 px-3 py-3">
            <div
              className={cn(
                'flex h-10 min-w-0 items-center gap-2.5 rounded-lg bg-muted/45 px-3',
                'ring-1 ring-border/70 transition-[background-color,box-shadow] duration-[var(--duration-hover)]',
                'focus-within:bg-background focus-within:ring-2 focus-within:ring-foreground/15',
                'dark:bg-muted/25 dark:focus-within:bg-background/50',
              )}
            >
              <Search
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={t('search.placeholder')}
                aria-label={t('search.placeholder')}
                className={cn(
                  'h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[0.9375rem] text-foreground shadow-none outline-none',
                  'placeholder:text-muted-foreground/65 focus-visible:ring-0 focus-visible:ring-offset-0',
                )}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden shrink-0 rounded-md bg-background/70 px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border/60 sm:inline">
                Esc
              </kbd>
            </div>
          </div>

          <div
            ref={listRef}
            className="max-h-[min(24rem,52vh)] overflow-y-auto overscroll-contain p-1.5"
          >
            {!hasQuery ? (
              <p className="px-3 py-8 text-center text-[0.8125rem] text-muted-foreground">
                {t('search.hint', { shortcut })}
              </p>
            ) : null}

            {empty ? (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                <SearchX className="size-8 text-muted-foreground/50" strokeWidth={1.5} />
                <p className="text-[0.875rem] font-medium text-foreground">
                  {t('search.emptyTitle')}
                </p>
                <p className="text-[0.8125rem] text-muted-foreground">
                  {t('search.emptyDesc', { query: query.trim() })}
                </p>
              </div>
            ) : null}

            {results.applications.length > 0 ? (
              <ResultGroup label={t('search.groupApplications')}>
                {results.applications.map((h, i) => {
                  const index = i
                  const item = flatItems[index]
                  const Icon = PLATFORM_ICON[h.application.platform]
                  return (
                    <ResultRow
                      key={item.key}
                      index={index}
                      active={activeIndex === index}
                      icon={LayoutGrid}
                      trailingIcon={Icon}
                      title={item.title}
                      subtitle={item.subtitle}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(item.href)}
                    />
                  )
                })}
              </ResultGroup>
            ) : null}

            {results.artifacts.length > 0 ? (
              <ResultGroup label={t('search.groupArtifacts')}>
                {results.artifacts.map((h, i) => {
                  const index = results.applications.length + i
                  const item = flatItems[index]
                  const Icon = PLATFORM_ICON[h.artifact.platform]
                  return (
                    <ResultRow
                      key={item.key}
                      index={index}
                      active={activeIndex === index}
                      icon={FileBox}
                      trailingIcon={Icon}
                      title={item.title}
                      subtitle={item.subtitle}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(item.href)}
                    />
                  )
                })}
              </ResultGroup>
            ) : null}
          </div>

          {hasQuery && !empty ? (
            <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
              <p className="text-[0.6875rem] text-muted-foreground">
                {t('search.resultCount', { count: results.total })}
              </p>
              <button
                type="button"
                onClick={goAll}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1',
                  'text-[0.75rem] font-medium text-muted-foreground',
                  'transition-colors duration-[var(--duration-hover)]',
                  'hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {t('search.viewAll')}
                <ArrowRight className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="border-t border-border/60 px-3 py-2">
              <p className="text-[0.6875rem] text-muted-foreground">
                {t('search.footerHint', { shortcut })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-1.5">
      <p className="px-2.5 py-1.5 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ResultRow({
  index,
  active,
  icon: Icon,
  trailingIcon: Trailing,
  title,
  subtitle,
  onMouseEnter,
  onClick,
}: {
  index: number
  active: boolean
  icon: typeof Search
  trailingIcon?: typeof Search
  title: string
  subtitle: string
  onMouseEnter: () => void
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-search-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left',
        'transition-colors duration-[var(--duration-hover)]',
        active ? 'bg-muted/70' : 'hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          active ? 'bg-background ring-1 ring-border/60' : 'bg-muted/50',
        )}
      >
        <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium text-foreground">
          {title}
        </span>
        <span className="block truncate text-[0.75rem] text-muted-foreground">
          {subtitle}
        </span>
      </span>
      {Trailing ? (
        <Trailing
          className="size-3.5 shrink-0 text-muted-foreground/70"
          strokeWidth={1.75}
        />
      ) : null}
    </button>
  )
}
