import { StatusBadge } from '@/components/common'
import { cn } from '@/lib/utils'
import { ARTIFACT_STATUS_LABEL, type ArtifactStatus } from '@/types/artifact'

const statusMap: Record<
  ArtifactStatus,
  'new' | 'default' | 'beta' | 'deprecated' | 'archived'
> = {
  latest: 'new',
  stable: 'default',
  beta: 'beta',
  deprecated: 'deprecated',
  archived: 'archived',
}

export function ArtifactStatusBadge({
  status,
  className,
}: {
  status: ArtifactStatus
  className?: string
}) {
  return (
    <StatusBadge
      status={statusMap[status]}
      className={cn(
        status === 'latest' ? 'uppercase tracking-wider' : 'normal-case',
        className,
      )}
    >
      {ARTIFACT_STATUS_LABEL[status]}
    </StatusBadge>
  )
}
