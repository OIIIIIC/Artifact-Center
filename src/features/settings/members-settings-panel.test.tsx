import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MembersSettingsPanel } from './members-settings-panel'

const listUsers = vi.fn()
const transferAdministrator = vi.fn()
const logout = vi.fn()

const authState = {
  user: {
    id: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
    username: 'admin',
    name: '当前管理员',
    email: 'admin@example.com',
    role: 'admin' as const,
    avatarUrl: null,
  },
  logout,
}

vi.mock('@/services/api', () => ({
  apiAdminResetPassword: vi.fn(),
  apiCreateUser: vi.fn(),
  apiDeleteUser: vi.fn(),
  apiListUsers: (...args: unknown[]) => listUsers(...args),
  apiTransferAdministrator: (...args: unknown[]) => transferAdministrator(...args),
  apiUpdateUser: vi.fn(),
}))

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) }
})

describe('成员权限设置', () => {
  beforeEach(() => {
    listUsers.mockReset()
    transferAdministrator.mockReset()
    logout.mockReset()
    listUsers.mockResolvedValue([
      authState.user,
      {
        id: '950b71a7-6100-4bfe-9b90-5e0c7defec02',
        username: 'receiver',
        name: '接收成员',
        email: 'receiver@example.com',
        role: 'viewer',
        avatarUrl: null,
      },
    ])
    transferAdministrator.mockResolvedValue(undefined)
  })

  function renderPanel() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <MembersSettingsPanel />
      </QueryClientProvider>,
    )
  }

  it('管理员本人不能在角色按钮组中直接降级，只能发起移交', async () => {
    renderPanel()

    const selfMarker = await screen.findByText('settings.you')
    const selfRow = selfMarker.closest('li')
    expect(selfRow).not.toBeNull()
    expect(
      within(selfRow as HTMLElement).getByRole('button', {
        name: 'settings.transferAdmin',
      }),
    ).toBeInTheDocument()
    expect(
      within(selfRow as HTMLElement).queryByRole('button', {
        name: 'settings.role.viewer',
      }),
    ).toBeNull()
  })

  it('移交管理员权限后退出当前会话', async () => {
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'settings.transferAdmin' }))
    expect(screen.getByText('settings.transferAdminTitle')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'settings.confirmTransferAdmin' }))

    await waitFor(() => {
      expect(transferAdministrator).toHaveBeenCalledWith({
        targetUserId: '950b71a7-6100-4bfe-9b90-5e0c7defec02',
        nextRole: 'viewer',
      })
      expect(logout).toHaveBeenCalledOnce()
    })
  })
})
