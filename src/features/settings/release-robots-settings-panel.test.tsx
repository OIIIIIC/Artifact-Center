import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReleaseRobotsSettingsPanel } from './release-robots-settings-panel'

const listReleaseRobots = vi.fn()
const createReleaseRobot = vi.fn()
const revokeReleaseRobot = vi.fn()

vi.mock('@/services/api', () => ({
  apiCreateReleaseRobot: (...args: unknown[]) => createReleaseRobot(...args),
  apiListReleaseRobots: (...args: unknown[]) => listReleaseRobots(...args),
  apiRevokeReleaseRobot: (...args: unknown[]) => revokeReleaseRobot(...args),
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
    createReleaseRobot.mockReset()
    revokeReleaseRobot.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
    expect(screen.getByText('settings.releaseRobotActiveStatus')).toBeInTheDocument()
    expect(screen.getByText('settings.releaseRobotActiveCount')).toBeInTheDocument()
    expect(listReleaseRobots).toHaveBeenCalledOnce()
  })

  it('默认收起已撤销记录并按有效机器人计数', async () => {
    const user = userEvent.setup()
    listReleaseRobots.mockResolvedValue([
      {
        id: 'active',
        name: '有效机器人',
        channels: ['beta'],
        expiresAt: '2099-01-01T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
        createdAt: '2026-08-13T00:00:00.000Z',
      },
      {
        id: 'revoked',
        name: '旧机器人',
        channels: ['beta', 'stable'],
        expiresAt: '2099-01-01T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: '2026-08-14T00:00:00.000Z',
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

    expect(await screen.findByText('有效机器人')).toBeInTheDocument()
    expect(screen.queryByText('旧机器人')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'settings.releaseRobotHistory' }))
    expect(screen.getByText('旧机器人')).toBeInTheDocument()
    expect(screen.getByText('settings.releaseRobotRevokedStatus')).toBeInTheDocument()
  })

  it('创建后提供安装配置并要求确认已保存 Token', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    listReleaseRobots.mockResolvedValue([])
    createReleaseRobot.mockResolvedValue({
      credential: {
        id: 'new-robot',
        name: 'Codex 发布机器人',
        channels: ['beta', 'stable'],
        expiresAt: '2099-01-01T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
        createdAt: '2026-08-13T00:00:00.000Z',
      },
      token: 'acrt_once_only',
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ReleaseRobotsSettingsPanel />
      </QueryClientProvider>,
    )

    await screen.findByText('settings.noReleaseRobots')
    await user.click(screen.getByRole('button', { name: 'settings.addReleaseRobot' }))
    await user.click(screen.getByRole('button', { name: 'settings.createReleaseRobot' }))

    expect(await screen.findByText('acrt_once_only')).toBeInTheDocument()
    expect(createReleaseRobot).toHaveBeenCalledOnce()
    const copySetup = screen.getByRole('button', {
      name: 'settings.copyReleaseRobotSetup',
    })
    expect(copySetup).toBeDisabled()
    expect(screen.queryByText(/<ARTIFACT_CENTER_MCP_PATH>/)).not.toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: 'settings.releaseRobotMcpPathLabel' }),
      'D:\\MyCode\\artifact-center\\plugins\\artifact-center-mcp',
    )
    expect(screen.getByText(/codex mcp add artifact-center/)).toBeInTheDocument()
    expect(
      screen.getByText(
        /\$mcpPath = 'D:\\MyCode\\artifact-center\\plugins\\artifact-center-mcp'/,
      ),
    ).toBeInTheDocument()
    expect(copySetup).toBeEnabled()
    const done = screen.getByRole('button', { name: 'common.done' })
    expect(done).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'settings.verifyReleaseRobot' }))
    expect(
      await screen.findByRole('button', { name: 'settings.releaseRobotVerified' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/release/applications',
      expect.objectContaining({
        headers: { Authorization: 'Bearer acrt_once_only' },
      }),
    )
    await user.click(
      screen.getByRole('checkbox', {
        name: 'settings.releaseRobotSavedConfirmation',
      }),
    )
    expect(done).toBeEnabled()
  })

  it('未确认保存时关闭会说明机器人已创建并要求二次确认', async () => {
    const user = userEvent.setup()
    listReleaseRobots.mockResolvedValue([])
    createReleaseRobot.mockResolvedValue({
      credential: {
        id: 'new-robot',
        name: 'Codex 发布机器人',
        channels: ['beta', 'stable'],
        expiresAt: '2099-01-01T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
        createdAt: '2026-08-13T00:00:00.000Z',
      },
      token: 'acrt_once_only',
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ReleaseRobotsSettingsPanel />
      </QueryClientProvider>,
    )

    await screen.findByText('settings.noReleaseRobots')
    await user.click(screen.getByRole('button', { name: 'settings.addReleaseRobot' }))
    await user.click(screen.getByRole('button', { name: 'settings.createReleaseRobot' }))
    await screen.findByText('acrt_once_only')

    await user.click(screen.getByRole('button', { name: 'common.close' }))
    expect(
      await screen.findByText('settings.releaseRobotDiscardTokenTitle'),
    ).toBeInTheDocument()
    expect(createReleaseRobot).toHaveBeenCalledOnce()

    await user.click(
      screen.getByRole('button', { name: 'settings.continueSavingReleaseRobotToken' }),
    )
    expect(screen.getByText('acrt_once_only')).toBeInTheDocument()
  })
})
