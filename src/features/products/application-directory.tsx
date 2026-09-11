import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronRight, Folder, AppWindow, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { applicationDirectoryHref } from '@/features/applications/detail-navigation'
import { useDirectorySummary } from '@/features/applications/use-directory-summary'
import { useRegions } from '@/features/regions/use-regions'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { apiApplicationPage } from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import type { Application, Project } from '@/types/application'
import {
  ProductDirectory,
  directoryRowClass,
  type DirectoryProps,
} from './product-directory'
import { useProjects } from './use-projects'

type Memory = {
  expanded: string
  query: string
  collapsed: boolean
  scrollTop: number
  projects: Record<string, boolean>
}
const empty: Memory = {
  expanded: 'all',
  query: '',
  collapsed: false,
  scrollTop: 0,
  projects: {},
}
// Navigation state is session-only and separated by user. Application data stays in QueryClient.
const useDirectoryMemory = create<{
  users: Record<string, Memory>
  change: (user: string, patch: Partial<Memory>) => void
}>((set) => ({
  users: {},
  change: (user, patch) =>
    set((state) => ({
      users: { ...state.users, [user]: { ...(state.users[user] ?? empty), ...patch } },
    })),
}))

export function ApplicationDirectory({
  directory,
  application,
  applicationId,
  tab = 'overview',
}: {
  directory?: DirectoryProps
  application?: Application
  applicationId?: string
  tab?: string
}) {
  const navigate = useNavigate()
  const owner = useAuthStore((s) => s.user?.id ?? 'anonymous')
  const memory = useDirectoryMemory((s) => s.users[owner] ?? empty)
  const update = useDirectoryMemory((s) => s.change)
  const change = (patch: Partial<Memory>) => update(owner, patch)
  const regions = useRegions()
  const projects = useProjects()
  const summary = useDirectorySummary()
  const revealed = useRef('')
  useEffect(() => {
    if (!application) return
    const path = `${application.id}:${application.region.id}:${application.projectId}`
    if (revealed.current === path) return
    revealed.current = path
    update(owner, {
      expanded: application.region.id,
      projects: {
        ...useDirectoryMemory.getState().users[owner]?.projects,
        ...(application.projectId ? { [application.projectId]: true } : {}),
      },
    })
  }, [application, owner, update])
  const selectedProduct = application?.region.id ?? memory.expanded
  const selectedProject = application?.projectId ?? 'all'
  const props: DirectoryProps = directory ?? {
    products: regions.regions,
    projects: projects.projects,
    counts: summary.data,
    productId: selectedProduct,
    projectId: selectedProject,
    loading: regions.loading || projects.loading || summary.isLoading,
    error: !!regions.error || !!projects.error || summary.isError,
    onRetry: () => {
      void regions.refetch()
      void projects.refetch()
      void summary.refetch()
    },
    onSelect: (product, project) => {
      const search = new URLSearchParams()
      if (product !== 'all') search.set('product', product)
      if (project && project !== 'all') search.set('project', project)
      navigate(`/${search.size ? `?${search}` : ''}`)
    },
  }
  const query = useDebouncedValue(memory.query.trim())
  return (
    <ProductDirectory
      {...props}
      navigation={{
        ...memory,
        change,
        renderProject: (project, count) => (
          <ProjectApplications
            project={project}
            count={count}
            open={!!memory.projects[project.id]}
            onToggle={() =>
              change({
                projects: {
                  ...memory.projects,
                  [project.id]: !memory.projects[project.id],
                },
              })
            }
            onSelect={() => props.onSelect(project.productId, project.id)}
            active={props.projectId === project.id}
            current={application}
            currentId={applicationId}
            tab={tab}
          />
        ),
        searchResults: (
          <DirectorySearch query={query} currentId={applicationId} tab={tab} />
        ),
      }}
    />
  )
}

function useDirectoryApps(project?: string, query = '') {
  return useInfiniteQuery({
    queryKey: ['applications', 'directory', { project, q: query }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      apiApplicationPage(
        { project, q: query, sort: 'name', limit: 30, cursor: pageParam },
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 60_000,
  })
}

function ApplicationRow({
  application,
  currentId,
  tab,
  path = false,
}: {
  application: Application
  currentId?: string
  tab: string
  path?: boolean
}) {
  const selected = currentId === application.id
  const reduceMotion = useReducedMotion()
  const element = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (!selected || !element.current) return
    const item = element.current
    let scrolling: HTMLElement | undefined
    // Wait for the product expansion to finish. Scroll only this directory, never the detail page.
    const timeout = window.setTimeout(
      () => {
        const container = item.closest<HTMLElement>('[data-directory-scroll]')
        if (!container || container.clientHeight === 0) return
        const row = item.getBoundingClientRect(),
          viewport = container.getBoundingClientRect()
        if (row.top >= viewport.top + 8 && row.bottom <= viewport.bottom - 8) return
        scrolling = container
        container.scrollTo({
          top:
            container.scrollTop +
            row.top -
            viewport.top -
            (viewport.height - row.height) * 0.45,
          behavior: reduceMotion ? 'instant' : 'smooth',
        })
      },
      reduceMotion ? 0 : 240,
    )
    return () => {
      window.clearTimeout(timeout)
      // A new selection supersedes this movement; never keep scrolling toward an old application.
      scrolling?.scrollTo({ top: scrolling.scrollTop, behavior: 'instant' })
    }
  }, [selected, reduceMotion])
  return (
    <Link
      ref={element}
      data-directory-select
      to={applicationDirectoryHref(application.id, tab)}
      aria-current={selected ? 'page' : undefined}
      title={application.name}
      className={cn(
        directoryRowClass,
        'w-full text-xs',
        selected
          ? 'bg-emerald-500/10 font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
          : 'text-muted-foreground',
      )}
    >
      <AppWindow className="size-3.5 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate">{application.name}</span>
        {path ? (
          <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">
            {application.region.name} / {application.projectName}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

function ProjectApplications({
  project,
  count,
  open,
  onToggle,
  onSelect,
  active,
  current,
  currentId,
  tab,
}: {
  project: Project
  count: number
  open: boolean
  onToggle: () => void
  onSelect: () => void
  active: boolean
  current?: Application
  currentId?: string
  tab: string
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  return (
    <>
      <div className="flex min-w-0 items-center">
        <button
          type="button"
          data-directory-select
          onClick={onSelect}
          title={project.name}
          aria-current={active && !currentId ? 'true' : undefined}
          className={cn(
            directoryRowClass,
            'text-xs',
            active ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          <Folder className="size-3.5 shrink-0" />
          <span className="truncate">{project.name}</span>
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {count}
          </span>
        </button>
        <button
          type="button"
          aria-label={t(open ? 'directory.collapse' : 'directory.expand', {
            name: project.name,
          })}
          aria-expanded={open}
          onClick={onToggle}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronRight
            className={cn(
              'size-3 transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.2, 0, 0, 1] }}
            className="ml-3 overflow-hidden border-l border-sidebar-border/70 pl-1"
          >
            <ProjectApplicationList
              project={project.id}
              current={current}
              currentId={currentId}
              tab={tab}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function ProjectApplicationList({
  project,
  current,
  currentId,
  tab,
}: {
  project: string
  current?: Application
  currentId?: string
  tab: string
}) {
  const query = useDirectoryApps(project)
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  // Keep a direct-linked current application visible even if it lies beyond the loaded page.
  const pinned =
    current?.projectId === project && !items.some((item) => item.id === current.id)
      ? current
      : undefined
  return (
    <>
      <ul>
        {(pinned ? [pinned, ...items] : items).map((item) => (
          <li key={item.id}>
            <ApplicationRow application={item} currentId={currentId} tab={tab} />
          </li>
        ))}
      </ul>
      <LoadState query={query} />
    </>
  )
}

function DirectorySearch({
  query: search,
  currentId,
  tab,
}: {
  query: string
  currentId?: string
  tab: string
}) {
  return search ? (
    <ApplicationSearchResults search={search} currentId={currentId} tab={tab} />
  ) : null
}
function ApplicationSearchResults({
  search,
  currentId,
  tab,
}: {
  search: string
  currentId?: string
  tab: string
}) {
  const { t } = useTranslation()
  const query = useDirectoryApps(undefined, search)
  return (
    <div className="mt-3 border-t border-sidebar-border/60 pt-2">
      <p className="px-2 py-1 text-[10px] text-muted-foreground">
        {t('directory.applicationMatches')}
      </p>
      <ul>
        {query.data?.pages
          .flatMap((page) => page.items)
          .map((item) => (
            <li key={item.id}>
              <ApplicationRow application={item} currentId={currentId} tab={tab} path />
            </li>
          ))}
      </ul>
      <LoadState query={query} />
    </div>
  )
}
function LoadState({ query }: { query: ReturnType<typeof useDirectoryApps> }) {
  const { t } = useTranslation()
  if (query.isError)
    return (
      <button
        type="button"
        className={cn(directoryRowClass, 'text-xs')}
        onClick={() =>
          void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
        }
      >
        {t('directory.loadFailed')} · {t('common.retry')}
      </button>
    )
  if (query.isLoading)
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground"
      >
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
        {t('directory.loading')}
      </p>
    )
  if (!query.data?.pages[0]?.total)
    return (
      <p className="px-2 py-2 text-xs text-muted-foreground">
        {t('directory.noApplications')}
      </p>
    )
  return query.hasNextPage ? (
    <button
      type="button"
      className={cn(directoryRowClass, 'text-xs text-muted-foreground')}
      disabled={query.isFetching}
      onClick={() => void query.fetchNextPage()}
    >
      {query.isFetchingNextPage
        ? t('directory.loading')
        : t('directory.moreApplications')}
    </button>
  ) : null
}
