import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Activity,
  Download,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  Share2,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { apiListAudit, type AuditLogItem } from '@/services/api'

interface ActivityPanelProps {
  applicationId: string
}

function actionVisual(action: string): { icon: LucideIcon; tone: string } {
  if (action.includes('delete')) {
    return { icon: Trash2, tone: 'bg-destructive/10 text-destructive' }
  }
  if (action.includes('share'))
    return { icon: Share2, tone: 'bg-muted/60 text-muted-foreground' }
  if (action.includes('upload'))
    return { icon: Upload, tone: 'bg-muted/60 text-muted-foreground' }
  if (action.includes('download')) {
    return { icon: Download, tone: 'bg-muted/60 text-muted-foreground' }
  }
  if (action.includes('create'))
    return { icon: Plus, tone: 'bg-muted/60 text-muted-foreground' }
  if (action.includes('update'))
    return { icon: Pencil, tone: 'bg-muted/60 text-muted-foreground' }
  if (action.includes('settings')) {
    return { icon: Settings2, tone: 'bg-muted/60 text-muted-foreground' }
  }
  if (action.includes('auth'))
    return { icon: KeyRound, tone: 'bg-muted/60 text-muted-foreground' }
  return { icon: Activity, tone: 'bg-muted/60 text-muted-foreground' }
}

function Row({ item, isLast }: { item: AuditLogItem; isLast: boolean }) {
  const { i18n } = useTranslation()
  void i18n.language
  const { icon: Icon, tone } = actionVisual(item.action)

  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 px-4 py-3.5 sm:px-5">
      <div className="relative flex justify-center">
        {!isLast ? (
          <span
            className="absolute top-8 bottom-[-0.875rem] w-px bg-border/70 dark:bg-border"
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            'relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
            tone,
          )}
          aria-hidden
        >
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium text-foreground">{item.summary}</p>
        <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
          {item.actorName}
          {' · '}
          <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
        </p>
      </div>
    </li>
  )
}

/**
 * Application activity timeline (audit log filtered by app).
 */
export function ActivityPanel({ applicationId }: ActivityPanelProps) {
  const { t } = useTranslation()
  const query = useInfiniteQuery({
    queryKey: queryKeys.audit.byApp(applicationId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiListAudit({ applicationId, limit: 30, offset: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  })

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
        <span className="text-[0.8125rem]">{t('common.loading')}</span>
      </div>
    )
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={Activity}
        title={t('activity.loadErrorTitle')}
        description={t('activity.loadErrorDesc')}
      />
    )
  }

  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={t('activity.emptyTitle')}
        description={t('activity.emptyDesc')}
      />
    )
  }

  return (
    <div className="space-y-3">
      <ul className="overflow-hidden rounded-xl ring-1 ring-border/70 dark:ring-border">
        {items.map((item, index) => (
          <Row key={item.id} item={item} isLast={index === items.length - 1} />
        ))}
      </ul>
      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? t('common.loading') : t('common.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
