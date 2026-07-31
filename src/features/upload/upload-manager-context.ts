import { createContext, useContext } from 'react'

import type { Application } from '@/types/application'
import type { UploadTask, VersionDraft } from '@/types/upload'

export interface UploadManagerValue {
  tasks: UploadTask[]
  startUpload: (input: {
    application: Application
    file: File
    version: VersionDraft
  }) => UploadTask
  retryUpload: (taskId: string) => void
  cancelUpload: (taskId: string) => void
}

export const UploadManagerContext = createContext<UploadManagerValue | null>(null)

export function useUploadManager() {
  const value = useContext(UploadManagerContext)
  if (!value) throw new Error('useUploadManager 必须在 UploadManagerProvider 内使用')
  return value
}
