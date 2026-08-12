import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  calculateUploadTelemetry,
  createUploadTelemetrySample,
} from '@/features/upload/upload-telemetry'
import { UploadManagerContext } from '@/features/upload/upload-manager-context'
import { uploadArtifactResumable } from '@/features/upload/resumable-upload'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/services/http'
import type { Application } from '@/types/application'
import type { PublishError, UploadTask, VersionDraft } from '@/types/upload'

type PendingUpload = {
  task: UploadTask
  file: File
  version: VersionDraft
  signature: string
}

const UPLOAD_STALL_THRESHOLD_MS = 15_000

function createTaskId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const pending = useRef(new Map<string, PendingUpload>())
  const controllers = useRef(new Map<string, AbortController>())
  const hasActiveUpload = tasks.some((task) => task.status === 'uploading')
  const hasTransferringUpload = tasks.some(
    (task) =>
      task.status === 'uploading' &&
      task.transferStage === 'transferring' &&
      task.lastProgressAt !== null &&
      !task.isStalled,
  )

  useEffect(() => {
    if (!hasActiveUpload) return

    const confirmBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', confirmBeforeUnload)
    return () => window.removeEventListener('beforeunload', confirmBeforeUnload)
  }, [hasActiveUpload])

  useEffect(() => {
    if (!hasTransferringUpload) return

    const timer = window.setInterval(() => {
      const now = Date.now()
      setTasks((current) => {
        let changed = false
        const next = current.map((task) => {
          if (
            task.status !== 'uploading' ||
            task.transferStage !== 'transferring' ||
            task.isStalled ||
            task.lastProgressAt === null ||
            now - task.lastProgressAt < UPLOAD_STALL_THRESHOLD_MS
          ) {
            return task
          }
          changed = true
          return { ...task, isStalled: true }
        })
        return changed ? next : current
      })
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [hasTransferringUpload])

  const updateTask = useCallback((taskId: string, patch: Partial<UploadTask>) => {
    setTasks((current) =>
      current.map((task) => (task.taskId === taskId ? { ...task, ...patch } : task)),
    )
  }, [])

  const runUpload = useCallback(
    async ({ task, file, version }: PendingUpload) => {
      const controller = new AbortController()
      controllers.current.set(task.taskId, controller)
      try {
        updateTask(task.taskId, {
          lastProgressAt: Date.now(),
          isStalled: false,
        })
        let telemetrySample = createUploadTelemetrySample(Date.now())

        await uploadArtifactResumable({
          appId: task.applicationId,
          file,
          fields: {
            version: version.version.trim(),
            buildNumber: version.buildNumber.trim(),
            platform: version.platform as Application['platform'],
            channel: version.channel,
            releaseNotes: version.releaseNotes,
            markLatest: version.markLatest,
          },
          onProgress: ({ progress, loadedBytes, totalBytes }) => {
            if (controllers.current.get(task.taskId) !== controller) return
            const now = Date.now()
            const telemetry = calculateUploadTelemetry(
              telemetrySample,
              loadedBytes,
              totalBytes,
              now,
            )
            telemetrySample = telemetry.sample
            updateTask(task.taskId, {
              progress,
              uploadedBytes: loadedBytes,
              speedBytesPerSecond: telemetry.speedBytesPerSecond,
              etaSeconds: telemetry.etaSeconds,
              transferStage: telemetry.stage,
              lastProgressAt: telemetry.stage === 'transferring' ? now : null,
              isStalled: false,
            })
          },
          signal: controller.signal,
        })

        if (controllers.current.get(task.taskId) !== controller) return
        const completedTask = {
          ...task,
          status: 'completed' as const,
          progress: 100,
          uploadedBytes: file.size,
          speedBytesPerSecond: null,
          etaSeconds: null,
          transferStage: 'processing' as const,
          lastProgressAt: null,
          isStalled: false,
          error: null,
        }
        pending.current.set(task.taskId, {
          task: completedTask,
          file,
          version,
          signature: task.taskId,
        })
        updateTask(task.taskId, completedTask)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.artifacts.byApp(task.applicationId),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.applications.detail(task.applicationId),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.releases.byApp(task.applicationId),
          }),
        ])
        toast.success(t('upload.taskCompleted'), {
          description: `${task.applicationName} · v${task.version}`,
        })
      } catch (error) {
        if (controllers.current.get(task.taskId) !== controller) return
        if (error instanceof ApiError && error.code === 'request_aborted') {
          const cancelledTask = {
            ...task,
            status: 'cancelled' as const,
            lastProgressAt: null,
            isStalled: false,
            error: null,
          }
          pending.current.set(task.taskId, {
            task: cancelledTask,
            file,
            version,
            signature: task.taskId,
          })
          updateTask(task.taskId, cancelledTask)
          return
        }
        const code: Exclude<PublishError, null> =
          error instanceof ApiError && error.code === 'duplicate_artifact'
            ? 'duplicate_artifact'
            : error instanceof ApiError && error.code === 'archived_application'
              ? 'archived_application'
              : 'upload_failed'
        const failedTask = {
          ...task,
          status: 'failed' as const,
          lastProgressAt: null,
          isStalled: false,
          error: code,
        }
        pending.current.set(task.taskId, {
          task: failedTask,
          file,
          version,
          signature: task.taskId,
        })
        updateTask(task.taskId, failedTask)
        toast.error(t('upload.taskFailed'), { description: task.fileName })
      } finally {
        if (controllers.current.get(task.taskId) === controller) {
          controllers.current.delete(task.taskId)
        }
      }
    },
    [queryClient, t, updateTask],
  )

  const startUpload = useCallback(
    ({
      application,
      file,
      version,
    }: {
      application: Application
      file: File
      version: VersionDraft
    }) => {
      const signature = `${application.id}|${file.name}|${file.size}|${version.version.trim()}|${version.buildNumber.trim()}`
      const existing = [...pending.current.values()].find(
        ({ task, signature: existingSignature }) =>
          task.status === 'uploading' && existingSignature === signature,
      )
      if (existing) return existing.task

      const task: UploadTask = {
        taskId: createTaskId(),
        fileName: file.name,
        fileSize: file.size,
        applicationId: application.id,
        applicationName: application.name,
        version: version.version.trim(),
        buildNumber: version.buildNumber.trim(),
        channel: version.channel,
        status: 'uploading',
        progress: 0,
        uploadedBytes: 0,
        speedBytesPerSecond: null,
        etaSeconds: null,
        transferStage: 'transferring',
        lastProgressAt: null,
        isStalled: false,
        error: null,
      }
      const upload = { task, file, version, signature }
      pending.current.set(task.taskId, upload)
      setTasks((current) => [
        task,
        ...current.filter((item) => item.taskId !== task.taskId),
      ])
      void runUpload(upload)
      return task
    },
    [runUpload],
  )

  const retryUpload = useCallback(
    (taskId: string) => {
      const upload = pending.current.get(taskId)
      if (!upload || upload.task.status === 'uploading') return
      const nextTask = {
        ...upload.task,
        status: 'uploading' as const,
        progress: 0,
        uploadedBytes: 0,
        speedBytesPerSecond: null,
        etaSeconds: null,
        transferStage: 'transferring' as const,
        lastProgressAt: null,
        isStalled: false,
        error: null,
      }
      const nextUpload = { ...upload, task: nextTask }
      pending.current.set(taskId, nextUpload)
      setTasks((current) =>
        current.map((task) => (task.taskId === taskId ? nextTask : task)),
      )
      void runUpload(nextUpload)
    },
    [runUpload],
  )

  const cancelUpload = useCallback(
    (taskId: string) => {
      const upload = pending.current.get(taskId)
      if (!upload || upload.task.status !== 'uploading') return

      const cancelledTask = {
        ...upload.task,
        status: 'cancelled' as const,
        lastProgressAt: null,
        isStalled: false,
        error: null,
      }
      pending.current.set(taskId, { ...upload, task: cancelledTask })
      updateTask(taskId, cancelledTask)
      controllers.current.get(taskId)?.abort()
    },
    [updateTask],
  )

  const value = useMemo(
    () => ({ tasks, startUpload, retryUpload, cancelUpload }),
    [cancelUpload, retryUpload, startUpload, tasks],
  )
  return (
    <UploadManagerContext.Provider value={value}>
      {children}
    </UploadManagerContext.Provider>
  )
}
