import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ApplicationCard } from './application-card'
import type { Application } from '@/types/application'

const currentUser = {
  id: 'user-current',
  username: 'current',
  name: '当前用户',
  email: 'current@example.com',
  role: 'maintainer' as const,
  avatarUrl: 'https://example.com/current.png',
}

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: { user: typeof currentUser }) => unknown) =>
    selector({ user: currentUser }),
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh-CN' } }),
  }
})

const application: Application = {
  id: 'app-1',
  name: '制品中心',
  applicationCode: 'artifact-center',
  description: '应用卡片测试',
  packageName: 'com.example.artifact',
  platform: 'android',
  region: {
    id: 'region-1',
    code: 'cn',
    name: '中国',
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
  },
  latestVersion: '1.0.0',
  updatedAt: '2026-08-13T00:00:00.000Z',
  createdAt: '2026-08-13T00:00:00.000Z',
  owner: '负责人',
  artifactCount: 1,
  status: 'active',
  repository: '',
  members: [
    { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl },
    { id: 'user-1', name: '成员一', avatarUrl: null },
    { id: 'user-2', name: '成员二', avatarUrl: null },
    { id: 'user-3', name: '成员三', avatarUrl: null },
  ],
}

describe('ApplicationCard', () => {
  it('始终先显示登录用户头像，再显示项目成员且不重复', () => {
    render(
      <MemoryRouter>
        <ApplicationCard application={application} />
      </MemoryRouter>,
    )

    expect(screen.getByTitle('当前用户')).toBeInTheDocument()
    expect(screen.getByTitle('成员一')).toBeInTheDocument()
    expect(screen.getByTitle('成员二')).toBeInTheDocument()
    expect(screen.queryAllByTitle('当前用户')).toHaveLength(1)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('收藏按钮独立于详情链接并提供即时操作', () => {
    const toggleFavorite = vi.fn()
    render(
      <MemoryRouter>
        <ApplicationCard
          application={application}
          favorite
          onToggleFavorite={toggleFavorite}
        />
      </MemoryRouter>,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: `applications.workspace.removeFavorite`,
      }),
    )
    expect(toggleFavorite).toHaveBeenCalledWith(application.id)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/applications/${application.id}`,
    )
  })
})
