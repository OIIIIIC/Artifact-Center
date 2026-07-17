import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/common'
import { CHANNEL_BADGE } from '@/features/upload/channel-meta'
import { cn } from '@/lib/utils'
import { getArtifactChannel, type Artifact } from '@/types/artifact'

/**
 * Release tags for an artifact.
 * - Latest flag: is this the current recommended download?
 * - Channel: 正式 / 测试 / 内部 / 弃用
 * When the UI context is already "latest version", set showLatest=false to avoid noise.
 */
export function ArtifactReleaseBadges({
  artifact,
  className,
  size = 'sm',
  showLatest = true,
}: {
  artifact: Artifact
  className?: string
  size?: 'sm' | 'md'
  /** Hide "最新" when the surrounding label already means latest */
  showLatest?: boolean
}) {
  const { t } = useTranslation()
  const channel = getArtifactChannel(artifact)
  const isLatest = artifact.status === 'latest'

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {showLatest && isLatest ? (
        <StatusBadge
          status="new"
          className={cn(
            'uppercase tracking-wider',
            size === 'md' && 'h-5 px-1.5 text-[10px]',
          )}
        >
          {t('status.latest')}
        </StatusBadge>
      ) : null}
      <span
        className={cn(
          'inline-flex items-center rounded-md font-medium',
          size === 'sm' && 'h-5 px-1.5 text-[10px]',
          size === 'md' && 'h-5 px-2 text-[11px]',
          CHANNEL_BADGE[channel],
        )}
      >
        {t(`channel.${channel}`)}
      </span>
      {artifact.status === 'archived' ? (
        <StatusBadge status="archived" className="normal-case">
          {t('status.archived')}
        </StatusBadge>
      ) : null}
    </span>
  )
}
