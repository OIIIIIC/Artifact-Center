import { useInfiniteQuery } from '@tanstack/react-query'
import { Activity, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query-keys'
import { apiListAudit } from '@/services/api'

import { SettingsPanel } from './settings-panel'

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

/** 平台管理员查看全局追加式审计记录。 */
export function OperationLogsSettingsPanel({
  hideHeader = false,
}: {
  hideHeader?: boolean
}) {
  const { t, i18n } = useTranslation()
  const query = useInfiniteQuery({
    queryKey: queryKeys.audit.global,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => apiListAudit({ limit: 50, offset: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  })

  const items = query.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <SettingsPanel
      title={t('settings.auditTitle')}
      description={t('settings.auditDesc')}
      wide
      hideHeader={hideHeader}
    >
      {query.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
          <span className="text-[0.8125rem]">{t('common.loading')}</span>
        </div>
      ) : null}

      {query.isError ? (
        <EmptyState
          icon={Activity}
          title={t('activity.loadErrorTitle')}
          description={t('activity.loadErrorDesc')}
          action={
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={t('activity.emptyTitle')}
          description={t('activity.emptyDesc')}
        />
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl bg-card/70 ring-1 ring-border/70">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <thead className="border-b border-border/60 bg-muted/30 text-[0.6875rem] font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 sm:px-5">{t('settings.auditAction')}</th>
                  <th className="px-4 py-3 sm:px-5">{t('settings.auditSummary')}</th>
                  <th className="px-4 py-3 sm:px-5">{t('settings.auditActor')}</th>
                  <th className="px-4 py-3 sm:px-5">{t('settings.auditIp')}</th>
                  <th className="px-4 py-3 text-right sm:px-5">
                    {t('settings.auditTime')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((item) => (
                  <tr key={item.id} className="align-top text-[0.8125rem]">
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-foreground sm:px-5">
                      {t(`activity.action.${item.action}`, { defaultValue: item.action })}
                    </td>
                    <td className="max-w-xl px-4 py-3.5 text-foreground sm:px-5">
                      {item.summary}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground sm:px-5">
                      {item.actorName}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[0.75rem] text-muted-foreground sm:px-5">
                      {item.ip ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-[0.75rem] text-muted-foreground sm:px-5">
                      <time dateTime={item.createdAt}>
                        {formatDateTime(item.createdAt, i18n.language)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      ) : null}
    </SettingsPanel>
  )
}
