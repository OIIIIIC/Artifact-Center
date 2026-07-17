import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CHANNEL_CHIP } from '@/features/upload/channel-meta'
import { cn } from '@/lib/utils'
import type { ApplicationPlatform } from '@/types/application'
import type { UploadChannel, VersionDraft } from '@/types/upload'

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

export function StepVersion({ version, onChange, onChannel }: StepVersionProps) {
  const { t } = useTranslation()

  return (
    <div className="w-full space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('upload.fieldVersion')} hint={t('upload.hintAuto')}>
          <input
            className={cn(inputClass, 'font-mono')}
            value={version.version}
            onChange={(e) => onChange({ version: e.target.value })}
            placeholder="1.0.0"
          />
        </Field>
        <Field label={t('upload.fieldBuild')} hint={t('upload.hintAutoShort')}>
          <input
            className={cn(inputClass, 'font-mono')}
            value={version.buildNumber}
            onChange={(e) => onChange({ buildNumber: e.target.value })}
            placeholder="1001"
          />
        </Field>
      </div>

      <Field label={t('upload.fieldPackage')} hint={t('upload.hintAutoShort')}>
        <input
          className={cn(inputClass, 'font-mono text-[0.8125rem]')}
          value={version.packageName}
          onChange={(e) => onChange({ packageName: e.target.value })}
          placeholder="com.example.app"
        />
      </Field>

      <Field label={t('upload.fieldPlatform')} hint={t('upload.hintAutoShort')}>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => {
            const active = version.platform === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ platform: p })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
                  'transition-colors duration-[var(--duration-hover)]',
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`platform.${p}`)}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label={t('upload.fieldChannel')}>
        <div
          className="flex max-w-full flex-wrap gap-1.5"
          role="group"
          aria-label={t('upload.fieldChannel')}
        >
          {CHANNELS.map((c) => {
            const active = version.channel === c
            const meta = CHANNEL_CHIP[c]
            return (
              <button
                key={c}
                type="button"
                title={t(`channelHint.${c}`)}
                onClick={() => onChannel(c)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
                  'transition-[background-color,box-shadow,color] duration-[var(--duration-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  active ? meta.selected : meta.idle,
                )}
                aria-pressed={active}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    meta.dot,
                    !active && 'opacity-70',
                  )}
                  aria-hidden
                />
                {t(`channel.${c}`)}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground">
          {t(`channelHint.${version.channel}`)}
        </p>
      </Field>

      <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <input
          type="checkbox"
          checked={version.markLatest}
          onChange={(e) => onChange({ markLatest: e.target.checked })}
          className="size-3.5 rounded border-border"
        />
        {t('upload.markLatest')}
      </label>

      <Field label={t('upload.fieldNotes')} hint={t('upload.hintOptional')}>
        <textarea
          value={version.releaseNotes}
          onChange={(e) => onChange({ releaseNotes: e.target.value })}
          rows={4}
          placeholder={t('upload.notesPlaceholder')}
          className={cn(
            inputClass,
            'h-auto min-h-[6.5rem] resize-y py-2.5 leading-relaxed',
          )}
        />
      </Field>
    </div>
  )
}
