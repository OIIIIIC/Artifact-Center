import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OperationLogsSettingsPanel } from './operation-logs-settings-panel'

const listAudit = vi.fn()

vi.mock('@/services/api', () => ({
  apiListAudit: (...args: unknown[]) => listAudit(...args),
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string }) =>
        options?.defaultValue ?? key,
      i18n: { language: 'zh-CN' },
    }),
  }
})

describe('操作日志设置面板', () => {
  it('读取并展示全局审计记录', async () => {
    listAudit.mockResolvedValue({
      items: [
        {
          id: 'audit-1',
          actorId: 'user-1',
          actorName: '管理员',
          action: 'artifact.upload',
          objectType: 'artifact',
          objectId: 'artifact-1',
          applicationId: 'app-1',
          applicationName: 'Mobile Banking',
          summary: '上传 Mobile Banking 2.1.0',
          meta: null,
          ip: '10.0.0.8',
          createdAt: '2026-08-11T12:00:00.000Z',
        },
      ],
      nextOffset: null,
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <OperationLogsSettingsPanel />
      </QueryClientProvider>,
    )

    await screen.findByText('上传 Mobile Banking 2.1.0')
    expect(screen.getByText('管理员')).toBeInTheDocument()
    expect(screen.getByText('Mobile Banking')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.8')).toBeInTheDocument()
    await waitFor(() => {
      expect(listAudit).toHaveBeenCalledWith({ limit: 50, offset: 0 })
    })
  })
})
