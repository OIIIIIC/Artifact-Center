import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function CollectionPagination({
  page,
  total,
  hasPrevious,
  hasNext,
  busy,
  onPrevious,
  onNext,
}: {
  page: number
  total: number
  hasPrevious: boolean
  hasNext: boolean
  busy: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  if (!hasPrevious && !hasNext) return null
  return (
    <nav
      aria-label={t('pagination.label')}
      className="mt-6 flex items-center justify-between gap-3 border-t border-border/60 pt-4"
    >
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {t('pagination.summary', { page, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!hasPrevious || busy}
          onClick={onPrevious}
        >
          <ChevronLeft className="size-3.5" />
          {t('pagination.previous')}
        </Button>
        <Button size="sm" variant="outline" disabled={!hasNext || busy} onClick={onNext}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {t('pagination.next')}
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  )
}
