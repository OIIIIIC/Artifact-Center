import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ENABLED_FILE_TYPES, ACCEPT_ATTR } from '@/features/upload/upload-meta'
import { formatFileSize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/application'
import type { ParsedArtifactFile, UploadFileError, UploadPhase } from '@/types/upload'
import { UPLOAD_MAX_BYTES } from '@/types/upload'
import { PLATFORM_LABEL } from '@/features/applications/platform-meta'

interface FileDropzoneProps {
  application?: Application
  phase: UploadPhase
  fileError: UploadFileError | null
  parsed: ParsedArtifactFile | null
  onFile: (file: File) => void
  onClear: () => void
}

const PHASE_COPY: Record<Exclude<UploadPhase, 'idle' | 'error' | 'ready'>, string> = {
  uploading: 'Uploading…',
  verifying: 'Verifying…',
  hashing: 'Calculating hash…',
}

const ERROR_COPY: Record<UploadFileError, string> = {
  too_large: `File is too large. Max size is ${formatFileSize(UPLOAD_MAX_BYTES)}.`,
  wrong_platform: 'File type does not match the selected application platform.',
  unsupported: 'This format is not enabled yet (IPA / Firmware / Docker).',
  empty: 'Empty file. Choose another artifact.',
}

/**
 * Visual center of the upload flow — deploy-style dropzone.
 */
export function FileDropzone({
  application,
  phase,
  fileError,
  parsed,
  onFile,
  onClear,
}: FileDropzoneProps) {
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
          dragOver && 'bg-muted/45 ring-border-strong ring-2',
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
              Drop artifact here
            </p>
            <p className="mt-1 max-w-sm text-[0.8125rem] text-muted-foreground">
              or click to browse · APK / AAB / EXE / ZIP
              {application ? ` · target ${PLATFORM_LABEL[application.platform]}` : ''}
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
              <p className="text-[0.9375rem] font-medium text-foreground">
                {PHASE_COPY[phase as keyof typeof PHASE_COPY]}
              </p>
              <p className="text-[0.75rem] text-muted-foreground">
                Mock pipeline — no real upload
              </p>
            </div>
            <div className="mt-2 flex w-48 gap-1">
              {(['uploading', 'verifying', 'hashing'] as const).map((p) => (
                <div
                  key={p}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-[var(--duration-page)]',
                    phase === p ||
                      (phase === 'verifying' && p === 'uploading') ||
                      (phase === 'hashing' && p !== 'hashing') ||
                      phase === 'hashing'
                      ? 'bg-foreground/70'
                      : 'bg-border',
                    phase === 'hashing' && 'bg-foreground/70',
                    phase === 'verifying' && p === 'uploading' && 'bg-foreground/70',
                    phase === 'verifying' && p === 'verifying' && 'bg-foreground/70',
                    phase === 'uploading' && p === 'uploading' && 'bg-foreground/70',
                  )}
                />
              ))}
            </div>
          </div>
        ) : null}

        {phase === 'ready' && parsed ? (
          <div className="flex w-full max-w-md flex-col items-stretch gap-3 text-left">
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
                  {parsed.platform ? ` · ${PLATFORM_LABEL[parsed.platform]}` : ''}
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
                <dt className="text-muted-foreground">SHA-256</dt>
                <dd className="truncate font-mono text-foreground/90">
                  {parsed.hash.slice(0, 16)}…{parsed.hash.slice(-8)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Detected version</dt>
                <dd className="font-mono text-foreground">v{parsed.suggestedVersion}</dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
            >
              <X className="size-3.5" />
              Replace file
            </Button>
          </div>
        ) : null}

        {phase === 'error' && fileError ? (
          <div className="flex max-w-sm flex-col items-center gap-3">
            <AlertCircle className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-[0.9375rem] font-medium text-foreground">Upload failed</p>
            <p className="text-[0.8125rem] text-muted-foreground">
              {ERROR_COPY[fileError]}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={(e) => {
                e.stopPropagation()
                onClear()
                inputRef.current?.click()
              }}
            >
              Try another file
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {ENABLED_FILE_TYPES.map((t) => (
          <span
            key={t.kind}
            className={cn(
              'rounded-md px-2 py-1 text-[0.6875rem] font-medium tracking-wide',
              t.enabled
                ? 'bg-muted/50 text-muted-foreground'
                : 'bg-transparent text-muted-foreground/45 line-through ring-1 ring-border/40',
            )}
          >
            {t.label}
            {!t.enabled ? ' · soon' : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
