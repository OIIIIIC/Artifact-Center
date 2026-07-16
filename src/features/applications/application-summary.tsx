import type { ReactNode } from 'react'

import { formatAbsoluteDate, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'
import type { Artifact } from '@/types/artifact'

interface ApplicationSummaryProps {
  application: Application
  latest?: Artifact
  artifactCount: number
  className?: string
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {label}
      </dt>
      <dd className="truncate text-[0.875rem] text-foreground">{children}</dd>
    </div>
  )
}

/**
 * Quiet metadata strip — object facts, not KPI cards.
 */
export function ApplicationSummary({
  application,
  latest,
  artifactCount,
  className,
}: ApplicationSummaryProps) {
  const lastUpload = latest?.uploadedAt ?? application.updatedAt

  return (
    <section
      className={cn(
        'rounded-2xl bg-muted/25 ring-1 ring-border/60 dark:bg-muted/15 dark:ring-border/80',
        className,
      )}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4 lg:p-6">
        <Cell label="Latest version">
          <span className="font-mono text-[0.8125rem]">v{application.latestVersion}</span>
        </Cell>
        <Cell label="Artifacts">{artifactCount}</Cell>
        <Cell label="Created">{formatAbsoluteDate(application.createdAt)}</Cell>
        <Cell label="Last upload">
          <time dateTime={lastUpload}>{formatRelativeTime(lastUpload)}</time>
        </Cell>
        <Cell label="Package">
          <span className="font-mono text-[0.75rem] text-muted-foreground">
            {application.packageName}
          </span>
        </Cell>
        <Cell label="Repository">
          <span className="font-mono text-[0.75rem] text-muted-foreground">
            {application.repository}
          </span>
        </Cell>
      </dl>
    </section>
  )
}
