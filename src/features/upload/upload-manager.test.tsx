import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { apiUploadArtifact } from '@/services/api'
import { ApiError } from '@/services/http'
import type { Application } from '@/types/application'
import { UploadManagerProvider } from './upload-manager'
import { useUploadManager } from './upload-manager-context'

vi.mock('@/services/api', () => ({
  apiUploadArtifact: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const application: Application = {
  id: 'app-test',
  name: '测试应用',
  description: '上传任务测试',
  packageName: 'com.example.test',
  platform: 'android',
  region: {
    id: 'region-test',
    code: 'test',
    name: '测试地域',
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  },
  latestVersion: '',
  updatedAt: '2026-07-30T00:00:00.000Z',
  createdAt: '2026-07-30T00:00:00.000Z',
  owner: 'Tester',
  artifactCount: 0,
  status: 'active',
  repository: '',
}

function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <UploadManagerProvider>{children}</UploadManagerProvider>
    </QueryClientProvider>
  )
}

function UploadProbe() {
  const { tasks, startUpload, cancelUpload, retryUpload } = useUploadManager()
  const task = tasks[0]

  return (
    <>
      <button
        type="button"
        onClick={() =>
          startUpload({
            application,
            file: new File(['artifact'], 'artifact.apk'),
            version: {
              version: '1.0.0',
              buildNumber: '1000',
              packageName: application.packageName,
              platform: 'android',
              channel: 'stable',
              releaseNotes: '',
              markLatest: true,
            },
          })
        }
      >
        开始
      </button>
      <button type="button" onClick={() => task && cancelUpload(task.taskId)}>
        取消
      </button>
      <button type="button" onClick={() => task && retryUpload(task.taskId)}>
        重试
      </button>
      <output>{task?.status ?? 'idle'}</output>
      <output data-testid="transfer-stage">{task?.transferStage ?? 'none'}</output>
      <output data-testid="stalled-state">
        {task?.isStalled ? 'stalled' : 'active'}
      </output>
      <output data-testid="last-progress">{task?.lastProgressAt ?? 'none'}</output>
    </>
  )
}

describe('UploadManagerProvider', () => {
  it('可以取消上传并从已取消状态重试', async () => {
    const signals: AbortSignal[] = []
    vi.mocked(apiUploadArtifact).mockImplementation(
      async (_appId, _file, _fields, _onProgress, signal) =>
        new Promise((_, reject) => {
          if (!signal) return
          signals.push(signal)
          signal.addEventListener(
            'abort',
            () =>
              reject(
                new ApiError({
                  status: 0,
                  code: 'request_aborted',
                  message: 'Request was cancelled',
                }),
              ),
            { once: true },
          )
        }),
    )

    render(<UploadProbe />, { wrapper: TestProviders })

    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByText('uploading')).toBeInTheDocument()
    const beforeUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnload)
    expect(beforeUnload.defaultPrevented).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument())
    expect(signals[0]?.aborted).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(screen.getByText('uploading')).toBeInTheDocument())
    expect(apiUploadArtifact).toHaveBeenCalledTimes(2)
    expect(signals[1]?.aborted).toBe(false)
  })

  it('15 秒无传输进度时标记停滞，新的进度和处理阶段会清除标记', async () => {
    vi.useFakeTimers()
    let reportProgress:
      | ((event: { progress: number; loadedBytes: number; totalBytes: number }) => void)
      | undefined
    vi.mocked(apiUploadArtifact).mockImplementation(
      async (_appId, _file, _fields, onProgress) => {
        reportProgress = onProgress
        return new Promise<never>(() => undefined)
      },
    )

    render(<UploadProbe />, { wrapper: TestProviders })
    fireEvent.click(screen.getByRole('button', { name: '开始' }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('last-progress')).not.toHaveTextContent('none')

    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.getByTestId('stalled-state')).toHaveTextContent('stalled')

    act(() => {
      reportProgress?.({ progress: 30, loadedBytes: 3, totalBytes: 10 })
    })
    expect(screen.getByTestId('stalled-state')).toHaveTextContent('active')

    act(() => {
      reportProgress?.({ progress: 100, loadedBytes: 10, totalBytes: 10 })
      vi.advanceTimersByTime(20_000)
    })
    expect(screen.getByTestId('transfer-stage')).toHaveTextContent('processing')
    expect(screen.getByTestId('stalled-state')).toHaveTextContent('active')
    vi.useRealTimers()
  })
})
