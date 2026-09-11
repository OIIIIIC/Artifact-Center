import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MembersSettingsPanel } from './members-settings-panel'

const listUsers = vi.fn()
const transferAdministrator = vi.fn()
const logout = vi.fn()
const createUser = vi.fn()
const resetPassword = vi.fn()

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
  apiAdminResetPassword: (...args: unknown[]) => resetPassword(...args),
  apiCreateUser: (...args: unknown[]) => createUser(...args),
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
    createUser.mockReset().mockResolvedValue({ name: '新成员', role: 'viewer' })
    resetPassword.mockReset().mockResolvedValue(undefined)
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

  it('创建成员保留取消后的草稿，成功后清空并刷新列表', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'settings.addMember' }))
    fireEvent.change(screen.getByLabelText('settings.fieldName'), {
      target: { value: '新成员' },
    })
    fireEvent.change(screen.getByLabelText('settings.fieldUsername'), {
      target: { value: 'new-member' },
    })
    fireEvent.change(screen.getByLabelText('settings.fieldEmail'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'settings.addMember' }))
    expect(screen.getByLabelText('settings.fieldName')).toHaveValue('新成员')
    fireEvent.change(screen.getByLabelText('settings.fieldTempPassword'), {
      target: { value: 'TestPass123!' },
    })
    fireEvent.change(screen.getByLabelText('settings.fieldTempConfirm'), {
      target: { value: 'TestPass123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'settings.confirmAddMember' }))
    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        name: '新成员',
        username: 'new-member',
        email: 'new@example.com',
        password: 'TestPass123!',
        role: 'viewer',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(listUsers.mock.calls.length).toBeGreaterThan(1)
    fireEvent.click(screen.getByRole('button', { name: 'settings.addMember' }))
    expect(screen.getByLabelText('settings.fieldName')).toHaveValue('')
  })

  it('重置密码拒绝不一致的确认值，并只提交选中成员', async () => {
    renderPanel()
    fireEvent.click(
      await screen.findByRole('button', { name: 'settings.resetPasswordTitle' }),
    )
    fireEvent.change(screen.getByLabelText('settings.fieldTempPassword'), {
      target: { value: 'TestPass123!' },
    })
    fireEvent.change(screen.getByLabelText('settings.fieldTempConfirm'), {
      target: { value: 'Different123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'settings.confirmResetPassword' }))
    expect(resetPassword).not.toHaveBeenCalled()
    expect(screen.getByText('settings.passwordErrorMismatch')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('settings.fieldTempConfirm'), {
      target: { value: 'TestPass123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'settings.confirmResetPassword' }))
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith(
        '950b71a7-6100-4bfe-9b90-5e0c7defec02',
        'TestPass123!',
      ),
    )
    await waitFor(() =>
      expect(
        screen.queryByLabelText('settings.fieldTempPassword'),
      ).not.toBeInTheDocument(),
    )
  })

  it('重置请求期间取消再打开表单不能重复提交', async () => {
    let finish!: () => void
    resetPassword.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    renderPanel()
    fireEvent.click(
      await screen.findByRole('button', { name: 'settings.resetPasswordTitle' }),
    )
    fireEvent.change(screen.getByLabelText('settings.fieldTempPassword'), {
      target: { value: 'TestPass123!' },
    })
    fireEvent.change(screen.getByLabelText('settings.fieldTempConfirm'), {
      target: { value: 'TestPass123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'settings.confirmResetPassword' }))
    await waitFor(() => expect(resetPassword).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'settings.resetPasswordTitle' }))
    expect(screen.getByLabelText('settings.fieldTempPassword')).toBeDisabled()
    const submit = screen.getByRole('button', { name: 'settings.resettingPassword' })
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(resetPassword).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    await waitFor(() =>
      expect(
        screen.queryByLabelText('settings.fieldTempPassword'),
      ).not.toBeInTheDocument(),
    )
  })

  it('上一成员的重置完成后不会关闭下一成员的表单', async () => {
    listUsers.mockResolvedValue([
      authState.user,
      { id: 'member-a', name: '成员A', email: 'a@example.com', role: 'viewer' },
      { id: 'member-b', name: '成员B', email: 'b@example.com', role: 'viewer' },
    ])
    let finish!: () => void
    resetPassword.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    renderPanel()
    const triggers = await screen.findAllByRole('button', {
      name: 'settings.resetPasswordTitle',
    })
    fireEvent.click(triggers[0])
    fireEvent.change(screen.getByLabelText('settings.fieldTempPassword'), {
      target: { value: 'TestPass123!' },
    })
    fireEvent.change(screen.getByLabelText('settings.fieldTempConfirm'), {
      target: { value: 'TestPass123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'settings.confirmResetPassword' }))
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith('member-a', 'TestPass123!'),
    )
    fireEvent.click(triggers[1])
    expect(screen.getByLabelText('settings.fieldTempPassword')).toHaveValue('')
    expect(screen.getByLabelText('settings.fieldTempPassword')).toBeDisabled()
    await act(async () => finish())
    await waitFor(() =>
      expect(screen.getByLabelText('settings.fieldTempPassword')).toBeEnabled(),
    )
    fireEvent.change(screen.getByLabelText('settings.fieldTempPassword'), {
      target: { value: 'AnotherPass123!' },
    })
    fireEvent.change(screen.getByLabelText('settings.fieldTempConfirm'), {
      target: { value: 'AnotherPass123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'settings.confirmResetPassword' }))
    await waitFor(() =>
      expect(resetPassword).toHaveBeenLastCalledWith('member-b', 'AnotherPass123!'),
    )
    await waitFor(() =>
      expect(
        screen.queryByLabelText('settings.fieldTempPassword'),
      ).not.toBeInTheDocument(),
    )
  })
})
