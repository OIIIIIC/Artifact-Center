import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReleaseRobotsSettingsPanel } from './release-robots-settings-panel'

const listReleaseRobots = vi.fn()

vi.mock('@/services/api', () => ({
  apiCreateReleaseRobot: vi.fn(),
  apiListReleaseRobots: (...args: unknown[]) => listReleaseRobots(...args),
  apiRevokeReleaseRobot: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'zh-CN' },
    }),
  }
})

describe('发布机器人设置面板', () => {
  beforeEach(() => {
    listReleaseRobots.mockReset()
  })

  it('展示平台级 Beta 机器人及其状态', async () => {
    listReleaseRobots.mockResolvedValue([
      {
        id: 'robot-1',
        name: 'Codex 发布机器人',
        channels: ['beta', 'stable'],
        expiresAt: '2026-11-11T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
        createdAt: '2026-08-13T00:00:00.000Z',
      },
    ])
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ReleaseRobotsSettingsPanel />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Codex 发布机器人')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('channel.stable')).toBeInTheDocument()
    expect(screen.getByText('settings.releaseRobotScopeDesc')).toBeInTheDocument()
    expect(listReleaseRobots).toHaveBeenCalledOnce()
  })
})
