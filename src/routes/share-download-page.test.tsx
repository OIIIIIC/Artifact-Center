import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { ShareResolveOk } from '@/features/share/resolve-share'
import { ShareDownloadPage } from './share-download-page'

const resolveShareToken = vi.fn()

vi.mock('@/features/share/resolve-share', () => ({
  resolveShareToken: (...args: unknown[]) => resolveShareToken(...args),
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { number?: string }) =>
        key === 'detail.build' ? `构建 ${options?.number}` : key,
    }),
  }
})

function TestQueryProvider({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('分享下载页', () => {
  it('以 Markdown 格式显示制品的发布说明', async () => {
    const result: ShareResolveOk = {
      ok: true,
      serverToken: 'share-token',
      sharedBy: '张盈睿',
      region: null,
      link: {
        id: 'share-1',
        kind: 'single',
        title: '三沙看护外屏',
        regionId: null,
        createdAt: '2026-08-13T00:00:00.000Z',
        expiresAt: null,
        downloadCount: 0,
      },
      items: [
        {
          id: 'share-item-1',
          mode: 'artifact',
          downloadCount: 0,
          available: true,
          unavailableReason: null,
          application: {
            id: 'app-1',
            name: '三沙看护外屏',
            applicationCode: 'care-screen',
            description: '',
            packageName: 'com.example.care',
            platform: 'android',
            region: {
              id: 'region-1',
              code: 'sansha',
              name: '三沙',
              sortOrder: 1,
              enabled: true,
              createdAt: '2026-08-13T00:00:00.000Z',
              updatedAt: '2026-08-13T00:00:00.000Z',
            },
            latestVersion: '0.0.2',
            updatedAt: '2026-08-13T00:00:00.000Z',
            createdAt: '2026-08-13T00:00:00.000Z',
            owner: '张盈睿',
            artifactCount: 1,
            status: 'active',
            repository: '',
          },
          artifact: {
            id: 'artifact-1',
            applicationId: 'app-1',
            version: '0.0.2',
            buildNumber: '1002',
            platform: 'android',
            sizeBytes: 265 * 1024 * 1024,
            uploadedAt: '2026-08-13T00:00:00.000Z',
            uploader: '张盈睿',
            status: 'stable',
            channel: 'stable',
            filename: 'sswp.apk',
            releaseNotes:
              '## 更新内容\n\n1. **优化**登录页自动退出机制\n2. [查看发布说明](https://example.com/releases/1002)',
          },
        },
      ],
    }
    resolveShareToken.mockResolvedValue(result)

    render(
      <MemoryRouter initialEntries={['/d/share-token']}>
        <Routes>
          <Route path="/d/:token" element={<ShareDownloadPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: TestQueryProvider },
    )

    expect(await screen.findByRole('heading', { name: '更新内容' })).toBeInTheDocument()
    expect(screen.getByRole('list')).toHaveTextContent('优化登录页自动退出机制')
    expect(screen.getByRole('strong')).toHaveTextContent('优化')
    expect(screen.getByRole('link', { name: '查看发布说明' })).toHaveAttribute(
      'href',
      'https://example.com/releases/1002',
    )
  })
})
