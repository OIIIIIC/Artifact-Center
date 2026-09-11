import { useTranslation } from 'react-i18next'
import type { DirectorySummary } from '@/services/api'
import type { Product, Project } from '@/types/application'

interface ApplicationScopeHeadingProps {
  productId: string
  projectId: string
  product?: Pick<Product, 'id' | 'name'>
  project?: Pick<Project, 'id' | 'name' | 'productId'>
  counts?: DirectorySummary
  loading: boolean
  error: boolean
}

/** The title describes the selected directory; its count is independent of list filters. */
export function ApplicationScopeHeading({
  productId,
  projectId,
  product,
  project,
  counts,
  loading,
  error,
}: ApplicationScopeHeadingProps) {
  const { t } = useTranslation()
  const allProducts = productId === 'all'
  const allProjects = projectId === 'all'
  const selectedProduct = product?.id === productId ? product : undefined
  const selectedProject =
    project?.id === projectId && project.productId === productId ? project : undefined
  const selectionExists =
    allProducts || !!(selectedProduct && (allProjects || selectedProject))
  const title = allProducts
    ? t('directory.allApplications')
    : ((allProjects ? selectedProduct?.name : selectedProject?.name) ??
      t(loading ? 'common.loading' : 'directory.unavailable'))
  const count =
    !loading && !error && counts && selectionExists
      ? allProducts
        ? counts.total
        : allProjects
          ? (counts.productCounts[productId] ?? 0)
          : (counts.projectCounts[projectId] ?? 0)
      : undefined

  return (
    <div className="flex h-11 min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <div
        className="flex min-w-0 flex-1 items-baseline gap-2 sm:gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <h1
          title={title}
          className="min-w-0 truncate text-[1.875rem] leading-[2.75rem] font-semibold tracking-tight text-foreground sm:text-[2.125rem]"
        >
          {title}
        </h1>
        {count !== undefined ? (
          <span className="shrink-0 text-[0.8125rem] whitespace-nowrap text-muted-foreground tabular-nums">
            {t('applications.count', { count })}
          </span>
        ) : loading ? (
          <span
            className="h-3 w-16 shrink-0 animate-pulse rounded bg-muted motion-reduce:animate-none"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  )
}
