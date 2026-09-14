import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { apiDeleteRegion, apiUpdateRegion } from '@/services/api'
import type { Product } from '@/types/application'
import { directoryError, useDirectoryMutation } from './directory-management'
import { DirectoryMenu, DirectoryMenuItem } from './directory-menu'
import { ProductEditor, type ProductDraft } from './product-editor'

export function ProductDetail({
  product,
  applicationCount,
  projectCount,
  draft,
  onDraftChange,
  onDeleted,
  children,
}: {
  product: Product
  applicationCount: number | null
  projectCount: number | null
  draft?: ProductDraft
  onDraftChange: (draft: ProductDraft | undefined) => void
  onDeleted: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const mutation = useDirectoryMutation()
  const [confirmation, setConfirmation] = useState<'status' | 'delete' | null>(null)
  const confirm = async () => {
    if (mutation.busy || (confirmation === 'delete' && applicationCount !== 0)) return
    try {
      await mutation.mutateAsync(() =>
        confirmation === 'delete'
          ? apiDeleteRegion(product.id)
          : apiUpdateRegion(product.id, { enabled: !product.enabled }),
      )
      setConfirmation(null)
      toast.success(
        t(
          confirmation === 'delete'
            ? 'settings.regionDeleted'
            : product.enabled
              ? 'settings.regionDisabled'
              : 'settings.regionEnabled',
        ),
      )
      if (confirmation === 'delete') onDeleted()
    } catch (error) {
      toast.error(directoryError(error, t))
    }
  }
  return (
    <motion.div
      layoutScroll
      initial={reduced ? false : { opacity: 0.5, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.16 }}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-card px-5 py-7 [scrollbar-width:thin] sm:px-8 sm:py-8 xl:px-10"
    >
      {draft ? (
        <ProductEditor
          product={product}
          draft={draft}
          onChange={onDraftChange}
          onCancel={() => onDraftChange(undefined)}
          onSaved={() => onDraftChange(undefined)}
        />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2.5 text-2xl font-semibold tracking-tight">
              <span className="min-w-0 break-all">{product.name}</span>
              {projectCount !== null ? (
                <span
                  className="inline-flex h-6 min-w-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 px-2 text-xs font-medium tabular-nums tracking-normal text-muted-foreground"
                  title={t('directory.projectCount', { count: projectCount })}
                  aria-label={t('directory.projectCount', { count: projectCount })}
                >
                  {projectCount}
                </span>
              ) : null}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  product.enabled && 'text-emerald-700 dark:text-emerald-300',
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {t(product.enabled ? 'settings.regionActive' : 'settings.regionInactive')}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              disabled={mutation.busy}
              onClick={() => {
                setConfirmation(null)
                onDraftChange({
                  name: product.name,
                  code: product.code,
                  sortOrder: String(product.sortOrder),
                })
              }}
            >
              <Pencil className="size-3.5" />
              {t('directory.editProduct')}
            </Button>
            <DirectoryMenu
              label={t('directory.more', { name: product.name })}
              disabled={mutation.busy}
            >
              {product.enabled ? (
                <DirectoryMenuItem asChild>
                  <Link to={`/applications/new?product=${product.id}`}>
                    <Plus className="size-3.5" />
                    {t('applications.newApplication')}
                  </Link>
                </DirectoryMenuItem>
              ) : null}
              <DirectoryMenuItem onSelect={() => setConfirmation('status')}>
                <Power className="size-3.5" />
                {t(
                  product.enabled
                    ? 'settings.disableRegionTitle'
                    : 'settings.enableRegionTitle',
                )}
              </DirectoryMenuItem>
              <DirectoryMenuItem destructive onSelect={() => setConfirmation('delete')}>
                <Trash2 className="size-3.5" />
                {t('settings.deleteRegionTitle')}
              </DirectoryMenuItem>
            </DirectoryMenu>
          </div>
        </div>
      )}
      {confirmation ? (
        <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">
            {t(
              confirmation === 'delete'
                ? 'settings.deleteRegionTitle'
                : product.enabled
                  ? 'settings.disableRegionTitle'
                  : 'settings.enableRegionTitle',
            )}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {confirmation === 'delete'
              ? applicationCount === null
                ? t('directory.countUnavailable')
                : t(
                    applicationCount
                      ? 'settings.regionDeleteBlockedDesc'
                      : 'settings.regionDeleteConfirmDesc',
                    { name: product.name, count: applicationCount },
                  )
              : t(
                  product.enabled
                    ? 'directory.disableProductHint'
                    : 'settings.enableRegionImpact',
                )}
          </p>
          {confirmation === 'delete' && applicationCount ? (
            <Link
              className="inline-block text-xs underline underline-offset-4"
              to={`/?product=${product.id}`}
            >
              {t('applications.title')} · {applicationCount}
            </Link>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={mutation.busy}
              onClick={() => setConfirmation(null)}
            >
              {t('common.cancel')}
            </Button>
            {confirmation !== 'delete' || applicationCount === 0 ? (
              <Button
                type="button"
                size="sm"
                variant={
                  confirmation === 'delete' || product.enabled ? 'destructive' : 'default'
                }
                disabled={mutation.busy}
                onClick={() => void confirm()}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {t(
                  confirmation === 'delete'
                    ? 'settings.deleteRegionAction'
                    : product.enabled
                      ? 'settings.confirmDisableRegion'
                      : 'settings.confirmEnableRegion',
                )}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </motion.div>
  )
}
