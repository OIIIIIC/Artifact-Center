import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ShareLinksPanel } from './share-links-panel'

const listShares = vi.fn()

vi.mock('@/services/api', () => ({
  apiListShares: (...args: unknown[]) => listShares(...args),
  apiRevokeShare: vi.fn(),
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: 'zh-CN' },
      t: (key: string, options?: { version?: string }) =>
        key === 'share.modePinnedVersion'
          ? `固定版本 · v${options?.version}`
          : key === 'share.revoke'
            ? '吊销'
            : key,
    }),
  }
})

function TestQueryProvider({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('分享链接列表', () => {
  it('显示固定版本号，并突出吊销操作', async () => {
    listShares.mockResolvedValue([
      {
        id: 'share-1',
        token: 'token-1',
        kind: 'single',
        title: 'Mobile Banking',
        regionId: 'region-1',
        applicationId: 'app-1',
        mode: 'artifact',
        artifactId: 'artifact-1',
        itemMode: 'artifact',
        artifactVersion: '2.7.1',
        createdBy: '张盈睿',
        createdAt: new Date().toISOString(),
        expiresAt: null,
        revokedAt: null,
        downloadCount: 1,
        itemCount: 1,
      },
    ])

    render(<ShareLinksPanel applicationId="app-1" />, {
      wrapper: TestQueryProvider,
    })

    expect(await screen.findByText('固定版本 · v2.7.1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '吊销' })).toHaveClass('text-destructive')
  })
})
