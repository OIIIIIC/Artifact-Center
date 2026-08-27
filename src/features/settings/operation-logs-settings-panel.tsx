import { useInfiniteQuery } from '@tanstack/react-query'
import { Activity, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
      className={hideHeader ? 'lg:h-full' : undefined}
    >
      <div className="flex min-h-[34rem] flex-col overflow-hidden rounded-2xl bg-card/70 ring-1 ring-border/70 lg:h-full lg:min-h-0">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-4 py-3 sm:px-5">
          <p className="text-[0.8125rem] text-muted-foreground">
            {t('settings.auditLoadedCount', { count: items.length })}
          </p>
        </div>

        {query.isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            <span className="text-[0.8125rem]">{t('common.loading')}</span>
          </div>
        ) : null}

        {query.isError ? (
          <div className="flex flex-1 items-center justify-center p-5">
            <EmptyState
              className="w-full max-w-md"
              icon={Activity}
              title={t('activity.loadErrorTitle')}
              description={t('activity.loadErrorDesc')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void query.refetch()}
                >
                  {t('common.retry')}
                </Button>
              }
            />
          </div>
        ) : null}

        {!query.isLoading && !query.isError && items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-5">
            <EmptyState
              className="w-full max-w-md"
              icon={Activity}
              title={t('activity.emptyTitle')}
              description={t('activity.emptyDesc')}
            />
          </div>
        ) : null}

        {items.length > 0 ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_30%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-thumb]:bg-clip-content hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/45 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
              <Table
                className="min-w-[54rem] table-fixed"
                containerClassName="overflow-visible"
              >
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[35%]" />
                  <col className="w-[15%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-muted/90 text-[0.6875rem] text-muted-foreground backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-12 px-4 font-medium sm:px-5">
                      {t('settings.auditAction')}
                    </TableHead>
                    <TableHead className="h-12 px-4 font-medium sm:px-5">
                      {t('settings.auditSummary')}
                    </TableHead>
                    <TableHead className="h-12 px-4 font-medium sm:px-5">
                      {t('settings.auditApplication')}
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center font-medium sm:px-5">
                      {t('settings.auditActor')}
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center font-medium sm:px-5">
                      {t('settings.auditIp')}
                    </TableHead>
                    <TableHead className="h-12 px-4 text-right font-medium sm:px-5">
                      {t('settings.auditTime')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="h-16 text-[0.8125rem]">
                      <TableCell className="px-4 py-3 sm:px-5">
                        <span className="inline-flex rounded-md bg-muted/65 px-2 py-1 text-[0.75rem] font-medium text-foreground">
                          {t(`activity.action.${item.action}`, {
                            defaultValue: item.action,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 font-medium text-foreground sm:px-5">
                        <p className="truncate" title={item.summary}>
                          {item.summary}
                        </p>
                      </TableCell>
                      <TableCell className="truncate px-4 py-3 text-muted-foreground sm:px-5">
                        {item.applicationName ?? '—'}
                      </TableCell>
                      <TableCell className="truncate px-4 py-3 text-center text-muted-foreground sm:px-5">
                        {item.actorName}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center font-mono text-[0.75rem] text-muted-foreground sm:px-5">
                        {item.ip ?? '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-[0.75rem] text-muted-foreground sm:px-5">
                        <time dateTime={item.createdAt}>
                          {formatDateTime(item.createdAt, i18n.language)}
                        </time>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {query.hasNextPage ? (
              <div className="flex shrink-0 justify-center border-t border-border/60 px-4 py-3">
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
          </>
        ) : null}
      </div>
    </SettingsPanel>
  )
}
