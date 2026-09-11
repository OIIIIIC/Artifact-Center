import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Product, Project } from '@/types/application'

interface ApplicationScopePathProps {
  productId: string
  projectId: string
  product?: Pick<Product, 'id' | 'name'>
  project?: Pick<Project, 'id' | 'name' | 'productId'>
  onSelect: (productId: string, projectId?: string) => void
}

export function ApplicationScopePath({
  productId,
  projectId,
  product,
  project,
  onSelect,
}: ApplicationScopePathProps) {
  const { t } = useTranslation()
  if (productId === 'all') return null

  const selectedProduct = product?.id === productId ? product : undefined
  const selectedProject =
    project?.id === projectId && project.productId === productId ? project : undefined
  const inProject = projectId !== 'all'
  const currentName =
    (inProject ? selectedProject?.name : selectedProduct?.name) ??
    t('directory.unavailable')
  const parentClass =
    'min-w-0 truncate rounded-sm py-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  return (
    <nav aria-label={t('applications.directoryPath')} className="min-w-0 text-xs">
      <button
        type="button"
        className={`${parentClass} flex items-center gap-1 whitespace-nowrap sm:hidden`}
        onClick={() => onSelect(inProject && selectedProduct ? productId : 'all')}
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        {t('applications.backToParent')}
      </button>
      <ol className="hidden min-w-0 items-center gap-1.5 sm:flex">
        <li className="shrink-0">
          <button
            type="button"
            className={parentClass}
            title={t('directory.allApplications')}
            onClick={() => onSelect('all')}
          >
            {t('directory.allApplications')}
          </button>
        </li>
        {inProject && selectedProduct ? (
          <>
            <li aria-hidden className="shrink-0 text-muted-foreground/60">
              <ChevronRight className="size-3" />
            </li>
            <li className="min-w-0 truncate">
              <button
                type="button"
                className={`${parentClass} max-w-full`}
                title={selectedProduct.name}
                onClick={() => onSelect(productId)}
              >
                {selectedProduct.name}
              </button>
            </li>
          </>
        ) : null}
        <li aria-hidden className="shrink-0 text-muted-foreground/60">
          <ChevronRight className="size-3" />
        </li>
        <li
          aria-current="page"
          title={currentName}
          className="min-w-0 truncate text-muted-foreground"
        >
          {currentName}
        </li>
      </ol>
    </nav>
  )
}
