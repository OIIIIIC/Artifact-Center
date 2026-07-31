import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  apiChangePassword: vi.fn(),
  apiLogin: vi.fn(),
  apiMe: vi.fn(),
  apiUpdateProfile: vi.fn(),
}))
const session = vi.hoisted(() => ({ setAccessToken: vi.fn() }))

vi.mock('@/services/api', () => api)
vi.mock('@/services/session', () => session)

import { useAuthStore } from '@/store/auth-store'

const user = {
  id: 'user-1',
  username: 'tester',
  name: '测试用户',
  email: 'tester@example.com',
  role: 'maintainer' as const,
  avatarUrl: null,
}

describe('修改密码后的会话轮换', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user, token: 'old-token', bootstrapped: true })
  })

  it('保存 API 返回的新令牌，避免旧令牌撤销后被登出', async () => {
    api.apiChangePassword.mockResolvedValue({ token: 'fresh-token' })

    await expect(
      useAuthStore.getState().changePassword({
        current: 'CurrentPassword9!',
        next: 'NewPassword9!',
        confirm: 'NewPassword9!',
      }),
    ).resolves.toEqual({ ok: true })

    expect(useAuthStore.getState().token).toBe('fresh-token')
    expect(session.setAccessToken).toHaveBeenLastCalledWith('fresh-token')
  })
})
