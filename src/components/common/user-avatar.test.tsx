import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UserAvatar } from './user-avatar'
import {
  DEFAULT_AVATAR_URLS,
  getDefaultAvatarUrl,
  getUserAvatarUrl,
} from './user-avatar-url'

describe('用户头像', () => {
  it('对未设置头像的同一用户稳定地分配本地头像库资源', () => {
    const first = getDefaultAvatarUrl('user-1')
    const second = getDefaultAvatarUrl('user-1')

    expect(first).toBe(second)
    expect(first).toMatch(/^\/avatar-library\/avatar-\d{2}\.jpg$/)
    expect(DEFAULT_AVATAR_URLS).toHaveLength(33)
  })

  it('优先使用用户选择或上传的头像', () => {
    expect(
      getUserAvatarUrl({
        id: 'user-1',
        avatarUrl: 'data:image/png;base64,custom',
      }),
    ).toBe('data:image/png;base64,custom')
  })

  it('不再展示历史 DiceBear 生成头像', () => {
    expect(
      getUserAvatarUrl({
        id: 'user-1',
        avatarUrl: 'data:image/svg+xml;base64,legacy-avatar',
      }),
    ).toBe(getDefaultAvatarUrl('user-1'))
  })

  it('在图片无法加载时保留用户名回退内容', () => {
    const { getByText } = render(
      <UserAvatar user={{ id: 'user-1', name: '张三', avatarUrl: null }} />,
    )

    expect(getByText('张')).toBeInTheDocument()
  })
})
