import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ACCEPT_ATTR, ENABLED_FILE_TYPES } from '@/features/upload/upload-meta'
import { formatFileSize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'
import type { ParsedArtifactFile, UploadFileError, UploadPhase } from '@/types/upload'
import { UPLOAD_MAX_BYTES } from '@/types/upload'

interface FileDropzoneProps {
  application?: Application
  phase: UploadPhase
  fileError: UploadFileError | null
  parsed: ParsedArtifactFile | null
  onFile: (file: File) => void
  onClear: () => void
}

export function FileDropzone({
  application,
  phase,
  fileError,
  parsed,
  onFile,
  onClear,
}: FileDropzoneProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback(
    (list: FileList | null) => {
      const file = list?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const busy = phase === 'uploading' || phase === 'verifying' || phase === 'hashing'

  const phaseLabel =
    phase === 'uploading'
      ? t('upload.uploading')
      : phase === 'verifying'
        ? t('upload.verifying')
        : phase === 'hashing'
          ? t('upload.hashing')
          : ''

  const errorMessage = (err: UploadFileError) => {
    if (err === 'too_large')
      return t('upload.errTooLarge', {
        size: formatFileSize(UPLOAD_MAX_BYTES),
      })
    if (err === 'wrong_platform') return t('upload.errWrongPlatform')
    if (err === 'unsupported') return t('upload.errUnsupported')
    return t('upload.errEmpty')
  }

  return (
    <div className="space-y-5">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!busy) inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!busy) handleFiles(e.dataTransfer.files)
        }}
        onClick={() => {
          if (!busy && phase !== 'ready') inputRef.current?.click()
        }}
        className={cn(
          'relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl px-6 py-12 text-center',
          'bg-muted/25 ring-1 ring-border/70 transition-[background-color,box-shadow,ring-color] duration-[var(--duration-page)]',
          'dark:bg-muted/15',
          dragOver && 'bg-muted/45 ring-2 ring-border-strong',
          phase === 'error' && 'ring-destructive/30',
          phase === 'ready' && 'cursor-default ring-border/50',
          busy && 'cursor-wait',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {phase === 'idle' || (phase === 'error' && !parsed) ? (
          <>
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-background ring-1 ring-border/70">
              <UploadCloud className="size-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-[0.9375rem] font-medium text-foreground">
              {t('upload.dropHere')}
            </p>
            <p className="mt-1 max-w-sm text-[0.8125rem] text-muted-foreground">
              {t('upload.dropHint')}
              {application
                ? t('upload.dropTarget', {
                    platform: t(`platform.${application.platform}`),
                  })
                : ''}
            </p>
          </>
        ) : null}

        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2
              className="size-8 animate-spin text-foreground/70"
              strokeWidth={1.5}
            />
            <div className="space-y-1">
              <p className="text-[0.9375rem] font-medium text-foreground">{phaseLabel}</p>
              <p className="text-[0.75rem] text-muted-foreground">
                {t('upload.mockPipeline')}
              </p>
            </div>
            <div className="mt-2 flex w-48 gap-1">
              {(['uploading', 'verifying', 'hashing'] as const).map((p) => (
                <div
                  key={p}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-[var(--duration-page)]',
                    phase === 'hashing' ||
                      (phase === 'verifying' && p !== 'hashing') ||
                      (phase === 'uploading' && p === 'uploading')
                      ? 'bg-foreground/70'
                      : 'bg-border',
                  )}
                />
              ))}
            </div>
          </div>
        ) : null}

        {phase === 'ready' && parsed ? (
          <div className="flex w-full max-w-xl flex-col items-stretch gap-3 text-left sm:mx-0">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background ring-1 ring-border/70">
                <FileArchive className="size-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-medium text-foreground">
                  {parsed.name}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                  {formatFileSize(parsed.sizeBytes)}
                  {parsed.platform ? ` · ${t(`platform.${parsed.platform}`)}` : ''}
                  {parsed.kind ? ` · ${parsed.kind.toUpperCase()}` : ''}
                </p>
              </div>
              <CheckCircle2
                className="size-5 shrink-0 text-foreground/70"
                strokeWidth={1.5}
              />
            </div>
            <dl className="grid gap-2 rounded-xl bg-background/60 p-3 text-[0.75rem] ring-1 ring-border/50">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('upload.sha256')}</dt>
                <dd className="truncate font-mono text-foreground/90">
                  {parsed.hash.slice(0, 16)}…{parsed.hash.slice(-8)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('upload.detectedVersion')}</dt>
                <dd className="font-mono text-foreground">v{parsed.suggestedVersion}</dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="self-start text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
            >
              <X className="size-3.5" />
              {t('upload.replaceFile')}
            </Button>
          </div>
        ) : null}

        {phase === 'error' && fileError ? (
          <div className="flex max-w-sm flex-col items-center gap-3">
            <AlertCircle className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-[0.9375rem] font-medium text-foreground">
              {t('upload.uploadFailed')}
            </p>
            <p className="text-[0.8125rem] text-muted-foreground">
              {errorMessage(fileError)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="default"
              className="mt-1"
              onClick={(e) => {
                e.stopPropagation()
                onClear()
                inputRef.current?.click()
              }}
            >
              {t('upload.tryAnother')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {ENABLED_FILE_TYPES.map((item) => (
          <span
            key={item.kind}
            className={cn(
              'rounded-md px-2 py-1 text-[0.6875rem] font-medium tracking-wide',
              item.enabled
                ? 'bg-muted/50 text-muted-foreground'
                : 'bg-transparent text-muted-foreground/45 line-through ring-1 ring-border/40',
            )}
          >
            {item.label}
            {!item.enabled ? ` · ${t('upload.soon')}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
