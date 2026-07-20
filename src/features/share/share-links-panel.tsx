import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiListShares, apiRevokeShare } from '@/services/api'
import { shareUrlForToken } from '@/store/share-store'

interface ShareLinksPanelProps {
  applicationId: string
  className?: string
}

/**
 * Active server share links for an application (create elsewhere; revoke here).
 */
export function ShareLinksPanel({ applicationId, className }: ShareLinksPanelProps) {
  const { t, i18n } = useTranslation()
  void i18n.language
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['shares', applicationId],
    queryFn: () => apiListShares(applicationId),
  })

  const items = (query.data ?? []).filter((s) => !s.revokedAt)
  // Treat missing expiry as active; expired links still listed until revoked
  const active = items.filter((s) => {
    if (!s.expiresAt) return true
    const exp = Date.parse(s.expiresAt)
    return Number.isNaN(exp) || exp > query.dataUpdatedAt
  })

  const onCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrlForToken(token))
      toast.success(t('share.copied'))
    } catch {
      toast.error(t('share.copyFailed'))
    }
  }

  const onRevoke = async (id: string) => {
    try {
      await apiRevokeShare(id)
      await queryClient.invalidateQueries({ queryKey: ['shares', applicationId] })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.audit.byApp(applicationId),
      })
      toast.success(t('share.revokedToast'))
    } catch (err) {
      toast.error(
        getRequestErrorMessage(err, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('share.revokeFailed'),
        }),
      )
    }
  }

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
        <span className="text-[0.8125rem]">{t('common.loading')}</span>
      </div>
    )
  }

  if (active.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title={t('share.listEmptyTitle')}
        description={t('share.listEmptyDesc')}
        className={cn('py-10', className)}
      />
    )
  }

  return (
    <ul
      className={cn(
        'divide-y divide-border/60 overflow-hidden rounded-2xl ring-1 ring-border/70',
        className,
      )}
    >
      {active.map((s) => (
        <li
          key={s.id}
          className="flex flex-col gap-2 bg-card/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:bg-card/25"
        >
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium text-foreground">
              {s.kind === 'collection'
                ? t('share.collectionLinkLabel', {
                    title: s.title || t('share.collectionFallbackTitle'),
                    count: s.itemCount,
                  })
                : s.mode === 'latest'
                  ? t('share.modeLatest')
                  : s.artifactVersion
                    ? t('share.modePinnedVersion', {
                        version: s.artifactVersion,
                      })
                    : t('share.modePinnedShort')}
              <span className="ml-2 font-normal text-muted-foreground">
                · {s.createdBy}
              </span>
            </p>
            <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
              <time dateTime={s.createdAt}>{formatRelativeTime(s.createdAt)}</time>
              {s.expiresAt
                ? ` · ${t('share.expiresAt', { date: new Date(s.expiresAt).toLocaleDateString() })}`
                : ` · ${t('share.expiryNever')}`}
              {typeof s.downloadCount === 'number'
                ? ` · ${t('share.downloadCount', { count: s.downloadCount })}`
                : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => void onCopy(s.token)}
            >
              <Copy className="size-3.5" strokeWidth={1.75} />
              {t('share.copyAgain')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/25"
              onClick={() => void onRevoke(s.id)}
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              {t('share.revoke')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
