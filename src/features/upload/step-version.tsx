import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { ApplicationPlatform } from '@/types/application'
import type { UploadChannel, VersionDraft } from '@/types/upload'
import { CHANNEL_LABEL } from '@/types/upload'

const CHANNELS: UploadChannel[] = ['stable', 'beta', 'internal', 'deprecated']

const PLATFORMS: ApplicationPlatform[] = ['android', 'windows', 'zip']

interface StepVersionProps {
  version: VersionDraft
  onChange: (patch: Partial<VersionDraft>) => void
  onChannel: (c: UploadChannel) => void
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8125rem] font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="text-[0.6875rem] text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  )
}

const inputClass = cn(
  'h-10 w-full rounded-lg bg-muted/30 px-3 text-[0.875rem] text-foreground outline-none',
  'ring-1 ring-border/60 transition-[box-shadow,background-color] duration-[var(--duration-hover)]',
  'placeholder:text-muted-foreground/60',
  'focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:opacity-60',
)

/**
 * Step 3 — mostly prefilled; only notes + channel need thought.
 */
export function StepVersion({ version, onChange, onChannel }: StepVersionProps) {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Version" hint="Auto-detected">
          <input
            className={cn(inputClass, 'font-mono')}
            value={version.version}
            onChange={(e) => onChange({ version: e.target.value })}
            placeholder="1.0.0"
          />
        </Field>
        <Field label="Build number" hint="Auto">
          <input
            className={cn(inputClass, 'font-mono')}
            value={version.buildNumber}
            onChange={(e) => onChange({ buildNumber: e.target.value })}
            placeholder="1001"
          />
        </Field>
      </div>

      <Field label="Package name" hint="Auto">
        <input
          className={cn(inputClass, 'font-mono text-[0.8125rem]')}
          value={version.packageName}
          onChange={(e) => onChange({ packageName: e.target.value })}
          placeholder="com.example.app"
        />
      </Field>

      <Field label="Platform" hint="Auto">
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => {
            const active = version.platform === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ platform: p })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium capitalize',
                  'transition-colors duration-[var(--duration-hover)]',
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                )}
              >
                {p}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Channel">
        <div className="inline-flex max-w-full flex-wrap rounded-lg bg-muted/40 p-0.5 dark:bg-muted/25">
          {CHANNELS.map((c) => {
            const active = version.channel === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChannel(c)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[0.8125rem] font-medium',
                  'transition-[color,background-color] duration-[var(--duration-hover)]',
                  active
                    ? 'bg-background text-foreground shadow-[var(--shadow-xs)] dark:bg-card'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {CHANNEL_LABEL[c]}
              </button>
            )
          })}
        </div>
      </Field>

      <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <input
          type="checkbox"
          checked={version.markLatest}
          onChange={(e) => onChange({ markLatest: e.target.checked })}
          className="size-3.5 rounded border-border"
        />
        Mark as Latest (automatic when published)
      </label>

      <Field label="Release notes" hint="Optional">
        <textarea
          value={version.releaseNotes}
          onChange={(e) => onChange({ releaseNotes: e.target.value })}
          rows={4}
          placeholder="What changed in this build…"
          className={cn(
            inputClass,
            'h-auto min-h-[6.5rem] resize-y py-2.5 leading-relaxed',
          )}
        />
      </Field>
    </div>
  )
}
