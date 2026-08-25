import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UserAvatar } from './user-avatar'
import { getGeneratedAvatarUrl, getUserAvatarUrl } from './user-avatar-url'

describe('用户头像', () => {
  it('对未设置头像的同一用户稳定地生成本地 SVG', () => {
    const first = getGeneratedAvatarUrl('user-1')
    const second = getGeneratedAvatarUrl('user-1')

    expect(first).toBe(second)
    expect(first).toMatch(/^data:image\/svg\+xml/)
    expect(first).not.toContain('api.dicebear.com')
  })

  it('优先使用用户选择或上传的头像', () => {
    expect(
      getUserAvatarUrl({
        id: 'user-1',
        avatarUrl: 'data:image/png;base64,custom',
      }),
    ).toBe('data:image/png;base64,custom')
  })

  it('在图片无法加载时保留用户名回退内容', () => {
    const { getByText } = render(
      <UserAvatar user={{ id: 'user-1', name: '张三', avatarUrl: null }} />,
    )

    expect(getByText('张')).toBeInTheDocument()
  })
})
