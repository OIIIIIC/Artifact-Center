import { Download } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArtifactStatusBadge } from '@/features/applications/artifact-status-badge'
import { PLATFORM_ICON, PLATFORM_LABEL } from '@/features/applications/platform-meta'
import { formatFileSize, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Artifact } from '@/types/artifact'

interface ArtifactsTableProps {
  artifacts: Artifact[]
  className?: string
}

/**
 * Modern data table — comfortable density, quiet hover, not ERP grid.
 */
export function ArtifactsTable({ artifacts, className }: ArtifactsTableProps) {
  if (artifacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 px-6 py-16 text-center">
        <p className="text-[0.9375rem] font-medium text-foreground">No artifacts yet</p>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          上传构建产物后，版本列表会显示在这里。
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
              Version
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              Platform
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              Size
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              Upload time
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              Uploader
            </TableHead>
            <TableHead className="h-11 px-4 text-[0.75rem] font-medium text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="h-11 w-[1%] px-4 text-right text-[0.75rem] font-medium text-muted-foreground">
              <span className="sr-only">Download</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {artifacts.map((art) => {
            const PlatformIcon = PLATFORM_ICON[art.platform]
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
                      Build {art.buildNumber}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                    <PlatformIcon className="size-3.5 opacity-70" strokeWidth={1.75} />
                    {PLATFORM_LABEL[art.platform]}
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
                  <ArtifactStatusBadge status={art.status} />
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right">
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-8 items-center gap-1 rounded-md px-2',
                      'text-[0.8125rem] font-medium text-muted-foreground',
                      'transition-colors duration-[var(--duration-hover)]',
                      'hover:bg-muted/60 hover:text-foreground',
                    )}
                    aria-label={`Download ${art.filename}`}
                  >
                    <Download className="size-3.5" strokeWidth={1.75} />
                    <span className="hidden sm:inline">Download</span>
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
