import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileSecurityPanel } from './profile-security-panel'

const updateProfile = vi.fn()
const updateAvatar = vi.fn()
const changePassword = vi.fn()

const authState = {
  user: {
    id: 'user-1',
    username: 'zhangsan',
    name: '张三',
    email: 'zhangsan@example.com',
    role: 'admin' as const,
    avatarUrl: null,
  },
  updateProfile,
  updateAvatar,
  changePassword,
}

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }
})

describe('账户设置面板', () => {
  beforeEach(() => {
    updateProfile.mockReset()
    updateAvatar.mockReset()
    changePassword.mockReset()
  })

  it('默认只展示登录安全摘要，按需打开密码表单', () => {
    render(<ProfileSecurityPanel />)

    expect(screen.getByText('zhangsan')).toBeInTheDocument()
    expect(screen.queryByLabelText('settings.fieldCurrentPassword')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'settings.changePassword' }))

    expect(screen.getByLabelText('settings.fieldCurrentPassword')).toBeInTheDocument()
    expect(screen.getByLabelText('settings.fieldNewPassword')).toBeInTheDocument()
    expect(screen.getByLabelText('settings.fieldConfirmPassword')).toBeInTheDocument()
  })

  it('取消修改密码后清空已输入内容', () => {
    render(<ProfileSecurityPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'settings.changePassword' }))
    fireEvent.change(screen.getByLabelText('settings.fieldCurrentPassword'), {
      target: { value: 'old-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'settings.changePassword' }))
    expect(screen.getByLabelText('settings.fieldCurrentPassword')).toHaveValue('')
  })
})
