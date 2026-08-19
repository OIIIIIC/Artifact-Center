import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Application } from '@/types/application'
import { BulkApplicationCodeDialog } from './bulk-application-code-dialog'

const bulkUpdate = vi.fn()

vi.mock('@/services/api', () => ({
  apiBulkUpdateApplicationCodes: (...args: unknown[]) => bulkUpdate(...args),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { name?: string }) =>
        key === 'applications.bulkCodeInputLabel' ? `${options?.name ?? ''}-code` : key,
    }),
  }
})

const region = {
  id: 'region-1',
  code: 'sansha',
  name: '三沙',
  sortOrder: 0,
  enabled: true,
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
}

function application(id: string, name: string, applicationCode: string): Application {
  return {
    id,
    name,
    applicationCode,
    description: `${name}说明`,
    packageName: `com.example.${id}`,
    platform: 'android',
    region,
    latestVersion: '1.0.0',
    updatedAt: '2026-08-13T00:00:00.000Z',
    createdAt: '2026-08-13T00:00:00.000Z',
    owner: '管理员',
    artifactCount: 1,
    status: 'active',
    repository: '',
  }
}

describe('批量设置应用代码', () => {
  beforeEach(() => {
    bulkUpdate.mockReset()
    bulkUpdate.mockResolvedValue(2)
  })

  it('允许多个应用批量保存相同代码', async () => {
    const onOpenChange = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <BulkApplicationCodeDialog
          open
          onOpenChange={onOpenChange}
          applications={[
            application('app-1', '医护屏', 'app'),
            application('app-2', '看护屏', 'screen'),
          ]}
        />
      </QueryClientProvider>,
    )

    const first = screen.getByLabelText('医护屏-code')
    const second = screen.getByLabelText('看护屏-code')
    await userEvent.clear(first)
    await userEvent.type(first, 'medical-screen')
    await userEvent.clear(second)
    await userEvent.type(second, 'medical-screen')
    await userEvent.click(
      screen.getByRole('button', { name: 'applications.bulkCodeSave' }),
    )

    await waitFor(() =>
      expect(bulkUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          { id: 'app-1', applicationCode: 'medical-screen' },
          { id: 'app-2', applicationCode: 'medical-screen' },
        ]),
      ),
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
