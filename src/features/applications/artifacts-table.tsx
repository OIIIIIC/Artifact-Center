import { Download, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArtifactReleaseBadges } from '@/features/applications/artifact-release-badges'
import { PLATFORM_ICON } from '@/features/applications/platform-meta'
import { useDownloadArtifact } from '@/features/applications/use-download-artifact'
import { formatFileSize, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Artifact } from '@/types/artifact'

interface ArtifactsTableProps {
  artifacts: Artifact[]
  className?: string
}

export function ArtifactsTable({ artifacts, className }: ArtifactsTableProps) {
  const { t, i18n } = useTranslation()
  void i18n.language
  const { download, isBusy } = useDownloadArtifact()

  if (artifacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 px-6 py-16 text-center">
        <p className="text-[0.9375rem] font-medium text-foreground">
          {t('detail.emptyArtifactsTitle')}
        </p>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          {t('detail.emptyArtifactsDesc')}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl ring-1 ring-border/70 dark:ring-border',
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 hover:bg-transparent">
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              {t('detail.colVersion')}
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              {t('detail.colPlatform')}
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              {t('detail.colSize')}
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              {t('detail.colUploadTime')}
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              {t('detail.colUploader')}
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              {t('detail.colStatus')}
            </TableHead>
            <TableHead className="h-11 w-[1%] px-4 text-right text-[0.75rem] font-medium text-muted-foreground">
              <span className="sr-only">{t('common.download')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {artifacts.map((art) => {
            const PlatformIcon = PLATFORM_ICON[art.platform]
            const busy = isBusy(art.id)
            return (
              <TableRow
                key={art.id}
                className={cn(
                  'border-border/50 transition-colors duration-[var(--duration-hover)]',
                  'hover:bg-muted/35 dark:hover:bg-muted/25',
                )}
              >
                <TableCell className="px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.8125rem] font-medium text-foreground">
                      v{art.version}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-muted-foreground/75">
                      {t('detail.build', { number: art.buildNumber })}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                    <PlatformIcon className="size-3.5 opacity-70" strokeWidth={1.75} />
                    {t(`platform.${art.platform}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-[0.8125rem] text-muted-foreground">
                  {formatFileSize(art.sizeBytes)}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-[0.8125rem] text-muted-foreground">
                  <time dateTime={art.uploadedAt}>
                    {formatRelativeTime(art.uploadedAt)}
                  </time>
                </TableCell>
                <TableCell className="px-4 py-3.5 text-[0.8125rem] text-foreground/90">
                  {art.uploader}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <ArtifactReleaseBadges artifact={art} />
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right">
                  <button
                    type="button"
                    disabled={busy}
                    className={cn(
                      'inline-flex h-8 items-center gap-1 rounded-md px-2',
                      'text-[0.8125rem] font-medium text-muted-foreground',
                      'transition-colors duration-[var(--duration-hover)]',
                      'hover:bg-muted/60 hover:text-foreground',
                      'disabled:pointer-events-none disabled:opacity-50',
                    )}
                    aria-label={`${t('common.download')} ${art.filename}`}
                    onClick={() =>
                      void download({
                        id: art.id,
                        filename: art.filename,
                        version: art.version,
                        sizeBytes: art.sizeBytes,
                      })
                    }
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <Download className="size-3.5" strokeWidth={1.75} />
                    )}
                    <span className="hidden sm:inline">{t('common.download')}</span>
                  </button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
