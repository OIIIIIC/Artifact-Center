import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { MarkdownPreview } from '@/components/common/markdown-preview'
import { CHANNEL_CHIP } from '@/features/upload/channel-meta'
import { cn } from '@/lib/utils'
import type { ApplicationPlatform } from '@/types/application'
import type { UploadChannel, VersionDraft, VersionSuggestionMode } from '@/types/upload'

const CHANNELS: UploadChannel[] = ['stable', 'beta', 'internal', 'deprecated']
const PLATFORMS: ApplicationPlatform[] = ['android', 'windows', 'zip']

interface StepVersionProps {
  version: VersionDraft
  applicationPlatform: ApplicationPlatform
  versionSuggestionMode: VersionSuggestionMode
  detectedVersion: string | null
  onChange: (patch: Partial<VersionDraft>) => void
  onChannel: (c: UploadChannel) => void
  onVersionSuggestionModeChange: (mode: VersionSuggestionMode) => void
}

/** Single control field — safe to use native label. */
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

/**
 * Multi-control group (chips) — never wrap in <label>, or browsers may
 * keep treating the first chip as “associated” and look multi-selected.
 */
function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8125rem] font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="text-[0.6875rem] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

const inputClass = cn(
  'h-10 w-full rounded-lg bg-muted/30 px-3 text-[0.875rem] text-foreground outline-none',
  'ring-1 ring-border/60 transition-[box-shadow,background-color] duration-[var(--duration-hover)]',
  'placeholder:text-muted-foreground/60',
  'focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:opacity-60',
)

export function StepVersion({
  version,
  applicationPlatform,
  versionSuggestionMode,
  detectedVersion,
  onChange,
  onChannel,
  onVersionSuggestionModeChange,
}: StepVersionProps) {
  const { t } = useTranslation()
  const channel = version.channel || 'stable'
  const [notesMode, setNotesMode] = useState<'edit' | 'preview'>('edit')
  const canUseFilenameVersion = Boolean(detectedVersion)

  return (
    <div className="w-full space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="block space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="artifact-version"
              className="text-[0.8125rem] font-medium text-foreground"
            >
              {t('upload.fieldVersion')}
            </label>
            <div
              className="inline-flex shrink-0 rounded-md bg-muted/50 p-0.5 ring-1 ring-border/60"
              role="group"
              aria-label={t('upload.fieldVersion')}
            >
              {(['increment', 'filename'] as const).map((mode) => {
                const active = versionSuggestionMode === mode
                const unavailable = mode === 'filename' && !canUseFilenameVersion
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={unavailable}
                    onClick={() => onVersionSuggestionModeChange(mode)}
                    title={
                      unavailable
                        ? t('upload.versionModeNoFilename')
                        : t('upload.versionModeToggle')
                    }
                    className={cn(
                      'rounded-sm px-2 py-0.5 text-[0.6875rem] font-medium',
                      'transition-[background-color,color,box-shadow] duration-[var(--duration-hover)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      active
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                      unavailable &&
                        'cursor-not-allowed opacity-45 hover:text-muted-foreground',
                    )}
                  >
                    {t(
                      mode === 'increment'
                        ? 'upload.versionModeIncrement'
                        : 'upload.versionModeFilename',
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <input
            id="artifact-version"
            className={cn(inputClass, 'font-mono')}
            value={version.version}
            onChange={(e) => onChange({ version: e.target.value })}
            placeholder="1.0.0"
          />
        </div>
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

      <FieldGroup label={t('upload.fieldPlatform')} hint={t('upload.hintAutoShort')}>
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label={t('upload.fieldPlatform')}
        >
          {PLATFORMS.map((p) => {
            const active = version.platform === p
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={p !== applicationPlatform}
                onClick={() => onChange({ platform: applicationPlatform })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
                  'transition-colors duration-[var(--duration-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-muted/40 text-muted-foreground opacity-50',
                )}
              >
                {t(`platform.${p}`)}
              </button>
            )
          })}
        </div>
      </FieldGroup>

      <FieldGroup label={t('upload.fieldChannel')}>
        <div
          className="flex max-w-full flex-wrap gap-1.5"
          role="radiogroup"
          aria-label={t('upload.fieldChannel')}
        >
          {CHANNELS.map((c) => {
            const active = channel === c
            const meta = CHANNEL_CHIP[c]
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                title={t(`channelHint.${c}`)}
                onClick={() => onChannel(c)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
                  'transition-[background-color,box-shadow,color] duration-[var(--duration-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  active ? meta.selected : meta.idle,
                )}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    active ? meta.dot : meta.dotIdle,
                  )}
                  aria-hidden
                />
                {t(`channel.${c}`)}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground">
          {t(`channelHint.${channel}`)}
        </p>
      </FieldGroup>

      <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <input
          type="checkbox"
          checked={version.markLatest}
          onChange={(e) => onChange({ markLatest: e.target.checked })}
          className="size-3.5 rounded border-border"
        />
        {t('upload.markLatest')}
      </label>

      <FieldGroup label={t('upload.fieldNotes')} hint={t('upload.hintOptional')}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.75rem] text-muted-foreground">
            {t('upload.notesMarkdownHint')}
          </p>
          <div
            className="inline-flex shrink-0 rounded-lg bg-muted/50 p-0.5 ring-1 ring-border/60"
            role="tablist"
            aria-label={t('upload.fieldNotes')}
          >
            {(['edit', 'preview'] as const).map((mode) => {
              const active = notesMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setNotesMode(mode)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[0.75rem] font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    active
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`upload.notes${mode === 'edit' ? 'Edit' : 'Preview'}`)}
                </button>
              )
            })}
          </div>
        </div>
        {notesMode === 'edit' ? (
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
        ) : (
          <MarkdownPreview
            content={version.releaseNotes}
            empty={
              <p className="text-[0.8125rem] text-muted-foreground">
                {t('upload.notesPreviewEmpty')}
              </p>
            }
            className="min-h-[6.5rem] rounded-lg bg-muted/20 p-3 ring-1 ring-border/60"
          />
        )}
      </FieldGroup>
    </div>
  )
}
