import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { useUploadFlow } from './use-upload-flow'
import type { Application } from '@/types/application'

vi.mock('@/features/applications/use-applications', () => ({
  useApplicationCatalog: () => ({ catalog: [], loading: false }),
}))
vi.mock('./upload-manager-context', () => ({
  useUploadManager: () => ({ tasks: [], startUpload: vi.fn() }),
}))
afterEach(() => vi.useRealTimers())

it.each([
  ['agent.zip', 'ready', null],
  ['agent.tar', 'ready', null],
  ['agent.tar.gz', 'ready', null],
  ['agent.tgz', 'ready', null],
  ['agent.deb', 'ready', null],
  ['agent.rpm', 'ready', null],
  ['agent.AppImage', 'ready', null],
  ['agent.exe', 'error', 'wrong_platform'],
  ['agent.apk', 'error', 'wrong_platform'],
  ['agent.aab', 'error', 'wrong_platform'],
  ['agent.msi', 'error', 'wrong_platform'],
  ['agent.txt', 'error', 'unsupported'],
] as const)('Linux upload preflight: %s', async (filename, phase, error) => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useUploadFlow(), {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  })
  const app = {
    platform: 'linux',
    latestVersion: '1.0.0',
    packageName: 'linux-agent',
  } as Application
  const file = new File(['audit'], filename)
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(5) })
  act(() => result.current.processFile(file, app))
  await act(async () => {
    vi.advanceTimersByTime(1300)
  })
  expect(result.current.phase).toBe(phase)
  expect(result.current.fileError).toBe(error)
  if (phase === 'ready') expect(result.current.version.platform).toBe('linux')
})
