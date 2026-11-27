import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApplicationBuildSettingsPanel } from './application-build-settings'
import {
  apiGetApplicationBuildConfig,
  apiSaveApplicationBuildConfig,
  apiTestApplicationBuildConfig,
} from '@/services/api/jenkins'
import type { Application } from '@/types/application'
import { apiApplicationPage } from '@/services/api/applications'
vi.mock('@/services/api/applications', () => ({ apiApplicationPage: vi.fn() }))

vi.mock('@/services/api/jenkins', async (original) => ({
  ...(await original<typeof import('@/services/api/jenkins')>()),
  apiGetApplicationBuildConfig: vi.fn(),
  apiSaveApplicationBuildConfig: vi.fn(),
  apiTestApplicationBuildConfig: vi.fn(),
}))
const auth = { user: { role: 'admin' } }
vi.mock('@/store/auth-store', () => ({
  useAuthStore: (select: (state: typeof auth) => unknown) => select(auth),
}))
vi.mock('react-i18next', async (original) => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))
const config = {
  enabled: true,
  jobPath: 'henan',
  artifactPattern: 'artifacts/*.tar.gz',
  parameters: [{ name: 'buildMode', value: 'test' }],
  revision: 2,
}
function show(status = 'active') {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ApplicationBuildSettingsPanel
        application={{ id: 'app-1', status } as Application}
      />
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  auth.user.role = 'admin'
  vi.mocked(apiGetApplicationBuildConfig).mockResolvedValue({
    config,
    connectionReady: true,
  })
})
it('校验任务使用当前草稿且不保存；保存后显示服务端配置', async () => {
  vi.mocked(apiTestApplicationBuildConfig).mockResolvedValue({
    ok: true,
    fullName: 'henan',
    parameters: [],
  })
  vi.mocked(apiSaveApplicationBuildConfig).mockResolvedValue({
    config: {
      ...config,
      revision: 3,
      parameters: [{ name: 'buildMode', value: 'prod' }],
    },
  })
  show()
  fireEvent.change(await screen.findByLabelText('jenkins.parameterValue 1'), {
    target: { value: 'prod' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.testJob' }))
  await screen.findByText('jenkins.jobSuccess')
  expect(apiTestApplicationBuildConfig).toHaveBeenCalledWith(
    'app-1',
    expect.objectContaining({ parameters: [{ name: 'buildMode', value: 'prod' }] }),
  )
  expect(apiSaveApplicationBuildConfig).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.save' }))
  await waitFor(() => expect(apiSaveApplicationBuildConfig).toHaveBeenCalled())
  await waitFor(() =>
    expect(screen.getByLabelText('jenkins.parameterValue 1')).toHaveValue('prod'),
  )
})
it('选择两个产物目标后保存精确应用和文件规则', async () => {
  vi.mocked(apiApplicationPage).mockResolvedValue({
    items: [
      {
        id: 'inner',
        name: '内屏',
        status: 'active',
        region: { name: '测试' },
      } as Application,
      {
        id: 'outer',
        name: '外屏',
        status: 'active',
        region: { name: '测试' },
      } as Application,
    ],
    total: 2,
    nextCursor: null,
  })
  vi.mocked(apiSaveApplicationBuildConfig).mockResolvedValue({
    config: { ...config, revision: 3 },
  })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'builds.addOutputTarget' }))
  await screen.findByRole('option', { name: '内屏 · 测试' })
  fireEvent.change(screen.getByLabelText('builds.outputPattern 1'), {
    target: { value: '**/inner-*.apk' },
  })
  fireEvent.change(screen.getByLabelText('builds.publishTarget 1'), {
    target: { value: 'inner' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'builds.addOutputTarget' }))
  fireEvent.change(screen.getByLabelText('builds.outputPattern 2'), {
    target: { value: '**/outer-*.apk' },
  })
  fireEvent.change(screen.getByLabelText('builds.publishTarget 2'), {
    target: { value: 'outer' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.save' }))
  await waitFor(() =>
    expect(apiSaveApplicationBuildConfig).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        outputTargets: [
          { name: '内屏', applicationId: 'inner', pattern: '**/inner-*.apk' },
          { name: '外屏', applicationId: 'outer', pattern: '**/outer-*.apk' },
        ],
      }),
    ),
  )
})
it.each(['maintainer', 'viewer'])('非管理员 %s 只能查看配置', async (role) => {
  auth.user.role = role
  show()
  expect(await screen.findByLabelText('jenkins.jobPath')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'jenkins.save' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'jenkins.testJob' }),
  ).not.toBeInTheDocument()
})
it('未连接时禁用校验和启用保存，但允许保存禁用的草稿', async () => {
  vi.mocked(apiGetApplicationBuildConfig).mockResolvedValue({
    config,
    connectionReady: false,
  })
  show()
  await screen.findByText('jenkins.connectionNeeded')
  expect(screen.getByRole('button', { name: 'jenkins.testJob' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'jenkins.save' })).toBeDisabled()
  fireEvent.click(screen.getByLabelText('jenkins.buildEnabled'))
  expect(screen.getByRole('button', { name: 'jenkins.save' })).toBeEnabled()
})
it('应用选择独立 Jenkins 后校验与保存该绑定，不受默认连接停用影响', async () => {
  vi.mocked(apiGetApplicationBuildConfig).mockResolvedValue({
    config,
    connectionReady: false,
    connections: [
      { id: 'default', name: '142', enabled: false },
      { id: 'henan-14', name: '河南 14', enabled: true },
    ],
  })
  vi.mocked(apiSaveApplicationBuildConfig).mockResolvedValue({
    config: { ...config, connectionId: 'henan-14', revision: 3 },
  })
  show()
  fireEvent.change(await screen.findByLabelText('jenkins.connection'), {
    target: { value: 'henan-14' },
  })
  expect(screen.getByRole('button', { name: 'jenkins.testJob' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.save' }))
  await waitFor(() =>
    expect(apiSaveApplicationBuildConfig).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ connectionId: 'henan-14' }),
    ),
  )
})
