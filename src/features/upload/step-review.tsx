import { AlertTriangle } from 'lucide-react'

import { PLATFORM_LABEL } from '@/features/applications/platform-meta'
import { formatFileSize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'
import type { ParsedArtifactFile, PublishError, VersionDraft } from '@/types/upload'
import { CHANNEL_LABEL } from '@/types/upload'

interface StepReviewProps {
  application: Application
  parsed: ParsedArtifactFile
  version: VersionDraft
  publishError: PublishError
  draftSaved: boolean
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-[0.875rem] text-foreground sm:text-right',
          mono && 'truncate font-mono text-[0.8125rem]',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function StepReview({
  application,
  parsed,
  version,
  publishError,
  draftSaved,
}: StepReviewProps) {
  return (
    <div className="w-full space-y-4">
      {publishError === 'duplicate_version' ? (
        <div
          className={cn(
            'flex gap-3 rounded-xl bg-muted/40 px-4 py-3 ring-1 ring-border/70',
            'text-[0.8125rem] text-muted-foreground',
          )}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="font-medium text-foreground">Duplicate version</p>
            <p className="mt-0.5">
              v{version.version} already exists as the latest for {application.name}.
              Change the version before publishing.
            </p>
          </div>
        </div>
      ) : null}

      {draftSaved ? (
        <p className="rounded-xl bg-muted/30 px-4 py-3 text-[0.8125rem] text-muted-foreground ring-1 ring-border/50">
          Draft saved locally (mock). You can publish when ready.
        </p>
      ) : null}

      <dl
        className={cn(
          'space-y-3.5 rounded-2xl bg-muted/25 p-5 ring-1 ring-border/60',
          'dark:bg-muted/15',
        )}
      >
        <Row label="Application" value={application.name} />
        <Row label="Version" value={`v${version.version}`} mono />
        <Row label="Build" value={version.buildNumber} mono />
        <Row
          label="Platform"
          value={version.platform ? PLATFORM_LABEL[version.platform] : '—'}
        />
        <Row label="Channel" value={CHANNEL_LABEL[version.channel]} />
        <Row label="Latest" value={version.markLatest ? 'Yes' : 'No'} />
        <Row label="File" value={parsed.name} mono />
        <Row label="Size" value={formatFileSize(parsed.sizeBytes)} />
        <Row
          label="Hash"
          value={`${parsed.hash.slice(0, 12)}…${parsed.hash.slice(-8)}`}
          mono
        />
        <div className="border-t border-border/50 pt-3.5">
          <dt className="text-[0.75rem] text-muted-foreground">Release notes</dt>
          <dd className="mt-1.5 text-[0.875rem] leading-relaxed whitespace-pre-wrap text-foreground">
            {version.releaseNotes.trim() || (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
