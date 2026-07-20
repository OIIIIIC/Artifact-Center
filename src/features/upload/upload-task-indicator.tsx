import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { formatFileSize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUploadManager } from './upload-manager'

export function UploadTaskIndicator() {
  const { t } = useTranslation()
  const { tasks, retryUpload } = useUploadManager()
  const [collapsed, setCollapsed] = useState(false)
  const [hiddenCompletedIds, setHiddenCompletedIds] = useState<Set<string>>(
    () => new Set(),
  )

  const completedIdsToHide = useMemo(
    () =>
      tasks
        .filter(
          (task) => task.status === 'completed' && !hiddenCompletedIds.has(task.taskId),
        )
        .map((task) => task.taskId),
    [hiddenCompletedIds, tasks],
  )

  useEffect(() => {
    if (completedIdsToHide.length === 0) return
    const timer = window.setTimeout(() => {
      setHiddenCompletedIds((current) => {
        const next = new Set(current)
        completedIdsToHide.forEach((taskId) => next.add(taskId))
        return next
      })
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [completedIdsToHide])

  const visibleTasks = tasks.filter((task) => !hiddenCompletedIds.has(task.taskId))
  if (visibleTasks.length === 0) return null

  const activeTasks = visibleTasks.filter((task) => task.status === 'uploading')
  const activeCount = activeTasks.length
  const totalActiveBytes = activeTasks.reduce((sum, task) => sum + task.fileSize, 0)
  const overallProgress = totalActiveBytes
    ? Math.round(
        activeTasks.reduce((sum, task) => sum + task.fileSize * task.progress, 0) /
          totalActiveBytes,
      )
    : 100
  const hasFailed = visibleTasks.some((task) => task.status === 'failed')

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={t('upload.taskExpand')}
        className={cn(
          'fixed right-0 bottom-6 z-40 flex h-10 items-center gap-2 rounded-l-xl border border-r-0 border-border/70',
          'bg-popover/95 px-3 text-xs font-medium shadow-lg backdrop-blur-md',
          'transition-colors hover:bg-muted',
        )}
      >
        {activeCount > 0 ? (
          <Loader2 className="size-4 animate-spin text-primary" />
        ) : hasFailed ? (
          <XCircle className="size-4 text-destructive" />
        ) : (
          <CheckCircle2 className="size-4 text-emerald-600" />
        )}
        <span>
          {activeCount > 0
            ? t('upload.taskDockedUploading', { progress: overallProgress })
            : hasFailed
              ? t('upload.taskFailedShort')
              : t('upload.taskCompletedShort')}
        </span>
        <ChevronLeft className="size-3.5 text-muted-foreground" />
      </button>
    )
  }

  return (
    <aside
      aria-label={t('upload.taskEntry')}
      className="fixed right-4 bottom-4 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border/70 bg-popover/95 p-3 shadow-lg backdrop-blur-md"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <UploadCloud className="size-4 text-primary" />
        <span>{t('upload.taskEntry')}</span>
        {activeCount > 0 ? (
          <span className="text-xs text-muted-foreground">{activeCount}</span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          aria-label={t('upload.taskCollapse')}
          onClick={() => setCollapsed(true)}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {visibleTasks.map((task) => (
          <div key={task.taskId} className="rounded-lg bg-muted/45 p-2.5">
            <div className="flex items-start gap-2">
              {task.status === 'uploading' ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
              ) : task.status === 'completed' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{task.fileName}</p>
                <p className="text-[0.6875rem] text-muted-foreground">
                  {task.applicationName} · v{task.version} ·{' '}
                  {formatFileSize(task.fileSize)}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-200',
                      task.status === 'failed' ? 'bg-destructive' : 'bg-primary',
                    )}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                  {task.status === 'uploading'
                    ? t('upload.taskUploading', { progress: task.progress })
                    : task.status === 'completed'
                      ? t('upload.taskCompletedShort')
                      : t('upload.taskFailedShort')}
                </p>
              </div>
              {task.status === 'failed' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('upload.taskRetry')}
                  onClick={() => retryUpload(task.taskId)}
                >
                  <RotateCcw />
                </Button>
              ) : null}
            </div>
            {task.status === 'completed' ? (
              <Link
                className="mt-1.5 block text-right text-xs text-primary hover:underline"
                to={`/applications/${task.applicationId}`}
              >
                {t('upload.viewApplication')}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  )
}
