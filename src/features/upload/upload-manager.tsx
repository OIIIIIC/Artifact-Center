import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { queryKeys } from '@/lib/query-keys'
import { apiUploadArtifact } from '@/services/api'
import { ApiError } from '@/services/http'
import type { Application } from '@/types/application'
import type { PublishError, UploadTask, VersionDraft } from '@/types/upload'

type UploadManagerValue = {
  tasks: UploadTask[]
  startUpload: (input: {
    application: Application
    file: File
    version: VersionDraft
  }) => UploadTask
  retryUpload: (taskId: string) => void
}

type PendingUpload = {
  task: UploadTask
  file: File
  version: VersionDraft
  signature: string
}

const UploadManagerContext = createContext<UploadManagerValue | null>(null)

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

  const updateTask = useCallback((taskId: string, patch: Partial<UploadTask>) => {
    setTasks((current) =>
      current.map((task) => (task.taskId === taskId ? { ...task, ...patch } : task)),
    )
  }, [])

  const runUpload = useCallback(
    async ({ task, file, version }: PendingUpload) => {
      try {
        await apiUploadArtifact(
          task.applicationId,
          file,
          {
            version: version.version.trim(),
            buildNumber: version.buildNumber.trim(),
            platform: version.platform as Application['platform'],
            channel: version.channel,
            releaseNotes: version.releaseNotes,
            markLatest: version.markLatest,
          },
          (progress) => updateTask(task.taskId, { progress }),
        )

        const completedTask = {
          ...task,
          status: 'completed' as const,
          progress: 100,
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
        const code: Exclude<PublishError, null> =
          error instanceof ApiError && error.code === 'duplicate_artifact'
            ? 'duplicate_artifact'
            : error instanceof ApiError && error.code === 'archived_application'
              ? 'archived_application'
              : 'upload_failed'
        const failedTask = { ...task, status: 'failed' as const, error: code }
        pending.current.set(task.taskId, {
          task: failedTask,
          file,
          version,
          signature: task.taskId,
        })
        updateTask(task.taskId, failedTask)
        toast.error(t('upload.taskFailed'), { description: task.fileName })
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

  const value = useMemo(
    () => ({ tasks, startUpload, retryUpload }),
    [retryUpload, startUpload, tasks],
  )
  return (
    <UploadManagerContext.Provider value={value}>
      {children}
    </UploadManagerContext.Provider>
  )
}

export function useUploadManager() {
  const value = useContext(UploadManagerContext)
  if (!value) throw new Error('useUploadManager 必须在 UploadManagerProvider 内使用')
  return value
}
