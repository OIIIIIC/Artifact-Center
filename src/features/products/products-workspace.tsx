import { Box, Loader2, Plus, Search } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDirectorySummary } from '@/features/applications/use-directory-summary'
import { useRegions } from '@/features/regions/use-regions'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/application'
import { useDirectoryMutation } from './directory-management'
import { ProductDetail } from './product-detail'
import { ProductEditor, type ProductDraft } from './product-editor'
import { ProjectsManager, type ProjectDraft } from './projects-manager'
import { useProjects } from './use-projects'

function NewProductTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const present = useIsPresent()
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
      inert={!present}
      aria-hidden={!present || undefined}
    >
      <div className="px-1 pt-1 pb-3">{children}</div>
    </motion.div>
  )
}

export function ProductsWorkspace() {
  const { t } = useTranslation()
  const products = useRegions()
  const projects = useProjects()
  const applications = useDirectorySummary()
  const { busy } = useDirectoryMutation()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const productListRef = useRef<HTMLDivElement>(null)
  const [newDraft, setNewDraft] = useState<ProductDraft | null>(null)
  const [productDrafts, setProductDrafts] = useState<
    Record<string, ProductDraft | undefined>
  >({})
  const [projectDrafts, setProjectDrafts] = useState<
    Record<string, ProjectDraft | undefined>
  >({})
  const selectedId = params.get('product')
  const product =
    products.regions.find((p) => p.id === selectedId) ??
    products.regions.find((p) => p.enabled) ??
    products.regions[0]
  useEffect(() => {
    const list = productListRef.current
    const active = list?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!list || !active) return
    const bounds = list.getBoundingClientRect(),
      row = active.getBoundingClientRect()
    if (row.top < bounds.top) list.scrollTop += row.top - bounds.top
    else if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom
  }, [product?.id])
  const select = (id: string, replace = false) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (id) next.set('product', id)
        else next.delete('product')
        return next
      },
      { replace },
    )
  const grouped = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const p of projects.projects) {
      const group = map.get(p.productId) ?? []
      group.push(p)
      map.set(p.productId, group)
    }
    return map
  }, [projects.projects])
  const counts = useMemo(
    () =>
      applications.data && !applications.isError
        ? new Map(Object.entries(applications.data.projectCounts))
        : null,
    [applications.data, applications.isError],
  )
  const filtered = products.regions.filter((p) =>
    `${p.name} ${p.code}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )

  return (
    <main
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden md:flex-row"
      aria-label={t('settings.regionsTitle')}
    >
      <h1 className="sr-only">{t('settings.regionsTitle')}</h1>
      <section
        aria-label={t('directory.productList')}
        className="flex max-h-[38%] shrink-0 flex-col border-b border-border/70 bg-muted/20 md:max-h-none md:w-56 md:border-r md:border-b-0 xl:w-64"
      >
        <div className="shrink-0 space-y-3 px-4 pt-5 pb-3 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium">
              {t('directory.product')}{' '}
              <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
                {products.loading ? '…' : products.regions.length}
              </span>
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('settings.addRegion')}
              disabled={busy || !!newDraft || products.loading || !!products.error}
              onClick={() =>
                setNewDraft({
                  name: '',
                  code: '',
                  sortOrder: String(
                    Math.min(
                      9999,
                      Math.max(0, ...products.regions.map((p) => p.sortOrder)) + 1,
                    ),
                  ),
                })
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="h-9 pl-8 text-xs"
              aria-label={t('directory.searchProducts')}
              placeholder={t('directory.searchProducts')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div
          ref={productListRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 [scrollbar-width:thin] sm:px-4"
        >
          <AnimatePresence initial={false}>
            {newDraft ? (
              <NewProductTransition key="new-product">
                <ProductEditor
                  draft={newDraft}
                  onChange={setNewDraft}
                  onCancel={() => setNewDraft(null)}
                  onSaved={(created) => {
                    setNewDraft(null)
                    setSearch('')
                    select(created.id)
                  }}
                />
              </NewProductTransition>
            ) : null}
          </AnimatePresence>
          {products.loading ? (
            <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('directory.loading')}
            </p>
          ) : products.error ? (
            <div className="space-y-2 p-3 text-xs">
              <p role="alert">{t('settings.regionsLoadFailed')}</p>
              <Button size="sm" variant="outline" onClick={() => void products.refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
              {filtered.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => select(p.id)}
                  aria-pressed={p.id === product?.id}
                  className={cn(
                    'relative flex min-w-0 items-center gap-2 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-ring motion-reduce:transition-none sm:gap-3',
                    p.id === product?.id &&
                      'bg-muted before:absolute before:inset-y-3.5 before:left-0 before:w-0.5 before:rounded-full before:bg-emerald-600 dark:before:bg-emerald-300',
                  )}
                >
                  <Box className="size-4 shrink-0 text-muted-foreground" />
                  <span
                    className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium"
                    title={p.name}
                  >
                    {p.name}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
                    {!p.enabled
                      ? t('settings.regionInactive')
                      : projects.loading || projects.error
                        ? '—'
                        : t('directory.projectCount', {
                            count: grouped.get(p.id)?.length ?? 0,
                          })}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!products.loading && !products.error && !filtered.length ? (
            <p className="p-3 text-xs text-muted-foreground">
              {t(
                products.regions.length
                  ? 'directory.noProductsMatch'
                  : 'settings.noRegions',
              )}
            </p>
          ) : null}
        </div>
      </section>
      {product && !products.error ? (
        <ProductDetail
          key={product.id}
          product={product}
          projectCount={
            projects.loading || projects.error
              ? null
              : (grouped.get(product.id)?.length ?? 0)
          }
          applicationCount={
            applications.data && !applications.isError
              ? (applications.data.productCounts[product.id] ?? 0)
              : null
          }
          draft={productDrafts[product.id]}
          onDraftChange={(draft) =>
            setProductDrafts((current) => ({ ...current, [product.id]: draft }))
          }
          onDeleted={() =>
            setParams(
              (current) => {
                const next = new URLSearchParams(current)
                if (next.get('product') === product.id) next.delete('product')
                return next
              },
              { replace: true },
            )
          }
        >
          {applications.error ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <p role="alert">{t('directory.countUnavailable')}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void applications.refetch()}
              >
                {t('common.retry')}
              </Button>
            </div>
          ) : null}
          {projects.loading ? (
            <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('directory.loading')}
            </p>
          ) : projects.error ? (
            <div className="mt-10 space-y-3 text-xs">
              <p role="alert">{t('directory.loadFailed')}</p>
              <Button size="sm" variant="outline" onClick={() => void projects.refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <ProjectsManager
              product={product}
              projects={grouped.get(product.id) ?? []}
              counts={counts}
              draft={projectDrafts[product.id]}
              onDraftChange={(draft) =>
                setProjectDrafts((current) => ({ ...current, [product.id]: draft }))
              }
            />
          )}
        </ProductDetail>
      ) : (
        <div className="flex min-h-40 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          {t(
            products.loading
              ? 'directory.loading'
              : products.error
                ? 'directory.loadFailed'
                : 'settings.noRegionsHint',
          )}
        </div>
      )}
    </main>
  )
}
