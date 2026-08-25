import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/lib/query-keys'
import type { Artifact } from '@/types/artifact'
import { ArtifactsTable } from './artifacts-table'

const deleteArtifact = vi.fn()

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, values?: Record<string, string>) =>
        values?.number ? `${key} ${values.number}` : key,
      i18n: { language: 'zh-CN' },
    }),
  }
})

vi.mock('@/features/applications/use-download-artifact', () => ({
  useDownloadArtifact: () => ({
    download: vi.fn(),
    isBusy: () => false,
    downloadConfirmation: null,
  }),
}))

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    apiDeleteArtifact: (...args: unknown[]) => deleteArtifact(...args),
  }
})

const artifact: Artifact = {
  id: 'artifact-1',
  applicationId: 'app-1',
  version: '0.0.5',
  buildNumber: '1005',
  platform: 'android',
  type: 'apk',
  sizeBytes: 266 * 1024 * 1024,
  uploadedAt: '2026-08-24T00:00:00.000Z',
  uploader: '张盈睿',
  status: 'latest',
  channel: 'stable',
  releaseNotes: '',
  filename: 'sansha_caregiver_v0.0.5_b1005_stable.apk',
}

describe('ArtifactsTable filename column', () => {
  it('uses the available version-column width instead of a fixed 16rem cap', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ArtifactsTable artifacts={[artifact]} canManage={false} />
      </QueryClientProvider>,
    )

    const filename = screen.getByText(artifact.filename)
    expect(filename).not.toHaveClass('max-w-[16rem]')
    expect(filename).toHaveClass('w-full')
  })
})

describe('ArtifactsTable audit cache', () => {
  it('invalidates the global operation-log cache after deleting an artifact', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    deleteArtifact.mockResolvedValue(undefined)
    queryClient.setQueryData(queryKeys.audit.global, { items: [], nextOffset: null })

    render(
      <QueryClientProvider client={queryClient}>
        <ArtifactsTable
          artifacts={[artifact]}
          applicationId={artifact.applicationId}
          applicationName="看护外屏"
          canManage
        />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'detail.moreActions' }))
    await user.click(screen.getByRole('menuitem', { name: 'detail.deleteArtifact' }))
    await user.click(screen.getByRole('button', { name: 'detail.confirmDeleteArtifact' }))

    expect(deleteArtifact).toHaveBeenCalledWith(artifact.id)
    expect(queryClient.getQueryState(queryKeys.audit.global)?.isInvalidated).toBe(true)
  })
})
