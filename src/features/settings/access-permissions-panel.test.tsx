import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { AccessPermissionsPanel } from './access-permissions-panel'

const listUsers = vi.fn()
const listApplications = vi.fn()
const listAccess = vi.fn()

vi.mock('@/services/api', () => ({
  apiBatchUpdateApplicationAccess: vi.fn(),
  apiListApplicationAccess: (...args: unknown[]) => listAccess(...args),
  apiListApplications: (...args: unknown[]) => listApplications(...args),
  apiListUsers: (...args: unknown[]) => listUsers(...args),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) }
})

describe('批量权限配置', () => {
  beforeEach(() => {
    listUsers.mockReset()
    listApplications.mockReset()
    listAccess.mockReset()
    listUsers.mockResolvedValue([
      {
        id: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
        username: 'owner',
        name: '负责人',
        email: 'owner@example.com',
        role: 'maintainer',
        avatarUrl: null,
      },
    ])
    listApplications.mockResolvedValue([
      {
        id: '98185fe8-e1a4-427d-b1db-6117c70b7f6c',
        name: '移动银行',
        description: '',
        packageName: 'com.example.bank',
        platform: 'android',
        region: {
          id: 'de05fc82-5cc2-4ef3-8318-7c0095c1a1d0',
          code: 'henan',
          name: '河南',
          sortOrder: 0,
          enabled: true,
          createdAt: '2026-08-11T00:00:00.000Z',
          updatedAt: '2026-08-11T00:00:00.000Z',
        },
        latestVersion: '',
        updatedAt: '2026-08-11T00:00:00.000Z',
        createdAt: '2026-08-11T00:00:00.000Z',
        owner: '负责人',
        artifactCount: 0,
        status: 'active',
        repository: '',
      },
    ])
    listAccess.mockResolvedValue([
      {
        applicationId: '98185fe8-e1a4-427d-b1db-6117c70b7f6c',
        role: 'maintainer',
        isOwner: true,
      },
    ])
  })

  it('首次展示默认用户时读取其真实权限并锁定负责人关系', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AccessPermissionsPanel isAdmin />
        </TooltipProvider>
      </QueryClientProvider>,
    )

    await screen.findByText('access.owner')
    await waitFor(() => {
      expect(listAccess).toHaveBeenCalledWith('4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1')
    })
    expect(screen.getAllByRole('checkbox')[1]).toBeDisabled()
  })
})
