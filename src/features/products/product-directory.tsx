import { Box, ChevronRight, Folder, Layers, Search } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { DirectorySummary } from '@/services/api'
import type { Application, Product, Project } from '@/types/application'

export interface DirectoryProps {
  products: Product[]
  projects: Project[]
  applications?: Application[]
  counts?: DirectorySummary
  productId: string
  projectId: string
  onSelect: (productId: string, projectId?: string) => void
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  navigation?: {
    expanded: string
    query: string
    collapsed: boolean
    scrollTop: number
    change: (
      patch: Partial<{
        expanded: string
        query: string
        collapsed: boolean
        scrollTop: number
      }>,
    ) => void
    renderProject: (project: Project, count: number) => ReactNode
    searchResults: ReactNode
  }
}

export const directoryRowClass =
  'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] outline-none transition-colors hover:bg-foreground/[0.045] focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none'

export function ProductDirectory({
  products,
  projects,
  applications = [],
  counts,
  productId,
  projectId,
  onSelect,
  loading,
  error,
  onRetry,
  navigation,
}: DirectoryProps) {
  const { t } = useTranslation()
  const id = useId()
  const [localExpanded, setLocalExpanded] = useState(productId)
  const previousProduct = useRef(productId)
  const [localQuery, setLocalQuery] = useState('')
  const expanded = navigation?.expanded ?? localExpanded
  const query = navigation?.query ?? localQuery
  const setExpanded = (value: string) =>
    navigation ? navigation.change({ expanded: value }) : setLocalExpanded(value)
  const setQuery = (value: string) =>
    navigation ? navigation.change({ query: value }) : setLocalQuery(value)
  const scroll = useRef<HTMLDivElement>(null)
  const rowClass = directoryRowClass
  // Restore expansion when the URL changes through browser history or mobile selection.
  useEffect(() => {
    if (previousProduct.current === productId) return
    previousProduct.current = productId
    setExpanded(productId)
  })
  useLayoutEffect(() => {
    // A newly mounted directory is already at zero. Assigning scrollTop even at
    // zero forces layout of the whole freshly mounted page.
    if (scroll.current && navigation && navigation.scrollTop > 0) {
      scroll.current.scrollTop = navigation.scrollTop
    }
    // Restore only on mount/load/collapse, never fight an ongoing user scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, navigation?.collapsed])
  const { productCounts, projectCounts, children } = useMemo(() => {
    const productCounts: Record<string, number> = {}
    const projectCounts: Record<string, number> = {}
    const children = new Map<string, Project[]>()
    for (const p of projects) {
      const list = children.get(p.productId) ?? []
      list.push(p)
      children.set(p.productId, list)
    }
    for (const app of applications) {
      productCounts[app.region.id] = (productCounts[app.region.id] ?? 0) + 1
      if (app.projectId)
        projectCounts[app.projectId] = (projectCounts[app.projectId] ?? 0) + 1
    }
    return {
      productCounts: counts?.productCounts ?? productCounts,
      projectCounts: counts?.projectCounts ?? projectCounts,
      children,
    }
  }, [applications, projects, counts])
  const search = query.trim().toLocaleLowerCase()
  const visible = products.filter(
    (p) =>
      !search ||
      p.name.toLocaleLowerCase().includes(search) ||
      children.get(p.id)?.some((c) => c.name.toLocaleLowerCase().includes(search)),
  )
  return (
    <section
      aria-label={t('directory.title')}
      className="flex min-h-0 flex-1 flex-col border-t border-sidebar-border/70 pt-4"
    >
      <div className="mb-2 flex shrink-0 items-center justify-between px-5 text-[11px] text-muted-foreground">
        {navigation ? (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-expanded={!navigation.collapsed}
            aria-label={t(
              navigation.collapsed
                ? 'directory.showDirectory'
                : 'directory.hideDirectory',
            )}
            onClick={() => navigation.change({ collapsed: !navigation.collapsed })}
          >
            <ChevronRight
              className={cn(
                'size-3 transition-transform duration-200 motion-reduce:transition-none',
                !navigation.collapsed && 'rotate-90',
              )}
            />
            {t('directory.title')}
          </button>
        ) : (
          <span>{t('directory.title')}</span>
        )}
        <span className="tabular-nums">{products.length}</span>
      </div>
      {!navigation?.collapsed &&
      (navigation || products.length > 8 || projects.length > 20) ? (
        <label className="relative mx-3 mb-2 block shrink-0">
          <Search
            className="absolute top-2.5 left-2 size-3.5 text-muted-foreground"
            aria-hidden
          />
          <input
            aria-label={t(navigation ? 'directory.searchAll' : 'directory.search')}
            placeholder={t(navigation ? 'directory.searchAll' : 'directory.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-sidebar-border/70 bg-transparent pr-2 pl-7 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
      ) : null}
      {!navigation?.collapsed ? (
        <div
          ref={scroll}
          data-directory-scroll
          onScroll={(event) =>
            navigation?.change({ scrollTop: event.currentTarget.scrollTop })
          }
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 [scrollbar-width:thin]"
        >
          <button
            type="button"
            data-directory-select
            className={cn(
              rowClass,
              'mb-1 w-full',
              productId === 'all' && 'bg-foreground/[0.06] font-medium',
            )}
            aria-current={productId === 'all' ? 'true' : undefined}
            onClick={() => onSelect('all')}
          >
            <Layers className="size-4 shrink-0" />
            <span className="truncate">{t('directory.allApplications')}</span>
            <Count value={counts?.total ?? applications.length} />
          </button>
          {loading ? (
            <p className="px-2 py-4 text-xs text-muted-foreground" role="status">
              {t('directory.loading')}
            </p>
          ) : null}
          {error ? (
            <button type="button" className={rowClass} onClick={onRetry}>
              {t('directory.loadFailed')} · {t('common.retry')}
            </button>
          ) : null}
          <ul className="space-y-0.5">
            {visible.map((product) => {
              const nested = children.get(product.id) ?? []
              const matchesProduct = product.name.toLocaleLowerCase().includes(search)
              const open = expanded === product.id || !!search
              const active = productId === product.id
              const panelId = `${id}-${product.id}`
              return (
                <li key={product.id}>
                  <div
                    className={cn(
                      'flex items-center rounded-lg',
                      active && 'bg-foreground/[0.055]',
                    )}
                  >
                    <button
                      type="button"
                      data-directory-select
                      className={cn(rowClass, active && 'font-medium')}
                      onClick={() => {
                        setExpanded(product.id)
                        onSelect(product.id)
                      }}
                      aria-current={active && projectId === 'all' ? 'true' : undefined}
                      title={product.name}
                    >
                      <Box className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{product.name}</span>
                      <Count value={productCounts[product.id] ?? 0} />
                    </button>
                    <button
                      type="button"
                      aria-label={t(open ? 'directory.collapse' : 'directory.expand', {
                        name: product.name,
                      })}
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setExpanded(open ? 'all' : product.id)}
                      disabled={!!search}
                      className="mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 transition-transform duration-200 motion-reduce:transition-none',
                          open && 'rotate-90',
                        )}
                      />
                    </button>
                  </div>
                  <DirectoryBranch id={panelId} open={open}>
                    <div className="overflow-hidden">
                      <ul className="my-1 ml-4 space-y-0.5 border-l border-sidebar-border/90 pl-2">
                        <li>
                          <button
                            type="button"
                            data-directory-select
                            className={cn(
                              rowClass,
                              'w-full text-xs text-muted-foreground',
                              active && projectId === 'all' && 'text-foreground',
                            )}
                            onClick={() => onSelect(product.id)}
                          >
                            <Layers className="size-3.5 shrink-0" />
                            <span className="truncate">{t('directory.allProjects')}</span>
                            <Count value={productCounts[product.id] ?? 0} />
                          </button>
                        </li>
                        {nested
                          .filter(
                            (p) =>
                              !search ||
                              matchesProduct ||
                              p.name.toLocaleLowerCase().includes(search),
                          )
                          .map((project) => (
                            <li key={project.id}>
                              {navigation ? (
                                open ? (
                                  navigation.renderProject(
                                    project,
                                    projectCounts[project.id] ?? 0,
                                  )
                                ) : null
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    data-directory-select
                                    className={cn(
                                      rowClass,
                                      'w-full text-xs',
                                      active && projectId === project.id
                                        ? 'bg-emerald-500/10 font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                                        : 'text-muted-foreground',
                                    )}
                                    aria-current={
                                      active && projectId === project.id
                                        ? 'true'
                                        : undefined
                                    }
                                    title={project.name}
                                    onClick={() => onSelect(product.id, project.id)}
                                  >
                                    <Folder className="size-3.5 shrink-0" />
                                    <span className="truncate">{project.name}</span>
                                    <Count value={projectCounts[project.id] ?? 0} />
                                  </button>
                                </>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </DirectoryBranch>
                </li>
              )
            })}
          </ul>
          {search && navigation ? navigation.searchResults : null}
          {!loading && !error && !visible.length && !navigation ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              {t('directory.noResults')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function DirectoryBranch({
  id,
  open,
  children,
}: {
  id: string
  open: boolean
  children: ReactNode
}) {
  const [visited, setVisited] = useState(open)
  if (open && !visited) setVisited(true)
  return (
    <div
      id={id}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-[220ms] ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      {/* Keep visited content during closing; unopened branches need no DOM. */}
      {open || visited ? children : <div className="overflow-hidden" />}
    </div>
  )
}

function Count({ value }: { value: number }) {
  return (
    <span className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground tabular-nums">
      {value}
    </span>
  )
}

export function CompactDirectory({
  products,
  projects,
  productId,
  projectId,
  onSelect,
}: DirectoryProps) {
  const { t } = useTranslation()
  const selectClass =
    'h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
  return (
    <div className="flex gap-2 lg:hidden">
      <select
        aria-label={t('directory.product')}
        className={selectClass}
        value={productId}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="all">{t('directory.allProducts')}</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t('directory.project')}
        className={selectClass}
        value={projectId}
        disabled={productId === 'all'}
        onChange={(e) => onSelect(productId, e.target.value)}
      >
        <option value="all">{t('directory.allProjects')}</option>
        {projects
          .filter((p) => p.productId === productId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
    </div>
  )
}
