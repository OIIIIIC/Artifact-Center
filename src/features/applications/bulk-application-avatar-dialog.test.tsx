import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Application } from '@/types/application'
import { BulkApplicationAvatarDialog } from './bulk-application-avatar-dialog'

const bulkUpdate = vi.fn()

vi.mock('@/services/api', () => ({
  apiBulkUpdateApplicationAppearance: (...args: unknown[]) => bulkUpdate(...args),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  }
})

const application: Application = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '医护屏',
  applicationCode: 'medical-screen',
  iconKey: 'auto',
  iconColor: 'auto',
  description: '医护屏应用',
  packageName: 'com.example.medical',
  platform: 'android',
  region: {
    id: 'region-1',
    code: 'sansha',
    name: '三沙',
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
  },
  latestVersion: '1.0.0',
  updatedAt: '2026-08-13T00:00:00.000Z',
  createdAt: '2026-08-13T00:00:00.000Z',
  owner: '管理员',
  artifactCount: 1,
  status: 'active',
  repository: '',
}

describe('批量设置应用头像', () => {
  beforeEach(() => {
    bulkUpdate.mockReset()
    bulkUpdate.mockResolvedValue(1)
  })

  it('可以只修改背景颜色并保留图标', async () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <BulkApplicationAvatarDialog
          open
          onOpenChange={vi.fn()}
          applications={[application]}
        />
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole('checkbox', { name: /医护屏/ }))
    await userEvent.click(
      screen.getByRole('button', { name: 'applications.bulkAvatarChangeColor' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'appAppearance.colors.rose' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'applications.bulkAvatarSave' }),
    )

    await waitFor(() =>
      expect(bulkUpdate).toHaveBeenCalledWith({
        applicationIds: [application.id],
        iconColor: 'rose',
      }),
    )
  })
})
