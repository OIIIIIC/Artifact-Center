import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/common'
import { cn } from '@/lib/utils'
import type { ArtifactStatus } from '@/types/artifact'

/** Map artifact lifecycle → semantic badge color */
const statusMap: Record<
  ArtifactStatus,
  'new' | 'default' | 'beta' | 'deprecated' | 'archived'
> = {
  latest: 'new', // emerald — current
  stable: 'default', // sky — production-safe
  beta: 'beta', // violet — experimental
  deprecated: 'deprecated', // amber — caution
  archived: 'archived', // stone — retired
}

export function ArtifactStatusBadge({
  status,
  className,
}: {
  status: ArtifactStatus
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <StatusBadge
      status={statusMap[status]}
      className={cn(
        status === 'latest' ? 'uppercase tracking-wider' : 'normal-case',
        className,
      )}
    >
      {t(`status.${status}`)}
    </StatusBadge>
  )
}
