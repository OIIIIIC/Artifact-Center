import { useQuery } from '@tanstack/react-query'
import { Activity, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/feedback'
import { formatRelativeTime } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { apiListAudit, type AuditLogItem } from '@/services/api'

interface ActivityPanelProps {
  applicationId: string
}

function actionTone(action: string): string {
  if (action.includes('delete')) return 'bg-destructive/15 text-destructive'
  if (action.includes('upload') || action.includes('create')) {
    return 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
  }
  if (action.includes('download')) {
    return 'bg-sky-500/12 text-sky-900 dark:text-sky-200'
  }
  return 'bg-muted text-muted-foreground'
}

function actionLabel(action: string, t: (k: string) => string): string {
  const key = `activity.action.${action}` as const
  const translated = t(key)
  return translated === key ? action : translated
}

function Row({ item }: { item: AuditLogItem }) {
  const { t, i18n } = useTranslation()
  void i18n.language

  return (
    <li className="flex gap-3 px-4 py-3.5">
      <span
        className={cn(
          'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium',
          actionTone(item.action),
        )}
      >
        {actionLabel(item.action, t)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] text-foreground">{item.summary}</p>
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
  const query = useQuery({
    queryKey: queryKeys.audit.byApp(applicationId),
    queryFn: () => apiListAudit({ applicationId, limit: 80 }),
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

  const items = query.data ?? []
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
    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl ring-1 ring-border/70">
      {items.map((item) => (
        <Row key={item.id} item={item} />
      ))}
    </ul>
  )
}
