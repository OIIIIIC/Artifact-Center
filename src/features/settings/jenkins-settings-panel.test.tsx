import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { JenkinsSettingsPanel } from './jenkins-settings-panel'
import {
  apiGetJenkinsSettings,
  apiSaveJenkinsSettings,
  apiTestJenkinsSettings,
} from '@/services/api/jenkins'

vi.mock('@/services/api/jenkins', async (original) => ({
  ...(await original<typeof import('@/services/api/jenkins')>()),
  apiGetJenkinsSettings: vi.fn(),
  apiSaveJenkinsSettings: vi.fn(),
  apiTestJenkinsSettings: vi.fn(),
}))
vi.mock('react-i18next', async (original) => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))
const connection = {
  baseUrl: 'http://jenkins:8080',
  username: 'builder',
  hasToken: true,
  enabled: true,
  revision: 1,
  updatedAt: '2026-10-13T00:00:00Z',
}
function show() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <JenkinsSettingsPanel />
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiGetJenkinsSettings).mockResolvedValue({ connection, keyReady: true })
})
it('保存的 Token 不回显；测试草稿不保存，保存后清空刚输入的 Token', async () => {
  vi.mocked(apiTestJenkinsSettings).mockResolvedValue({ ok: true, version: '2.580.1' })
  vi.mocked(apiSaveJenkinsSettings).mockResolvedValue({
    connection: { ...connection, revision: 2 },
    keyReady: true,
  })
  show()
  const token = await screen.findByLabelText('API Token')
  expect(token).toHaveValue('')
  fireEvent.change(token, { target: { value: 'new-private-token' } })
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.testConnection' }))
  await screen.findByText('jenkins.connectionSuccess')
  expect(apiSaveJenkinsSettings).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.save' }))
  await waitFor(() =>
    expect(apiSaveJenkinsSettings).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'new-private-token', revision: 1 }),
    ),
  )
  await waitFor(() => expect(screen.getByLabelText('API Token')).toHaveValue(''))
})
it('修改地址后必须补填 Token；失败不会丢失输入', async () => {
  vi.mocked(apiTestJenkinsSettings).mockRejectedValue(new Error('offline'))
  show()
  fireEvent.change(await screen.findByLabelText('jenkins.url'), {
    target: { value: 'http://new-jenkins:8080' },
  })
  expect(screen.getByLabelText('API Token')).toBeRequired()
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.testConnection' }))
  expect(apiTestJenkinsSettings).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('API Token'), {
    target: { value: 'replacement' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.testConnection' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('jenkins.url')).toHaveValue('http://new-jenkins:8080')
})
it('缺少加密密钥时明确说明原因并禁止保存', async () => {
  vi.mocked(apiGetJenkinsSettings).mockResolvedValue({
    connection: null,
    keyReady: false,
  })
  show()
  await screen.findByText('jenkins.keyMissing')
  expect(screen.getByRole('button', { name: 'jenkins.save' })).toBeDisabled()
})
it('添加第二台 Jenkins 使用独立连接编号，保留原服务器', async () => {
  vi.mocked(apiSaveJenkinsSettings).mockImplementation(async (input) => ({
    connection: { ...connection, ...input, hasToken: true, revision: 1 },
    keyReady: true,
  }))
  show()
  await screen.findByLabelText('jenkins.url')
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.addConnection' }))
  fireEvent.change(screen.getByLabelText('jenkins.connectionName'), {
    target: { value: '河南 14' },
  })
  fireEvent.change(screen.getByLabelText('jenkins.url'), {
    target: { value: 'http://jenkins-14:9999' },
  })
  fireEvent.change(screen.getByLabelText('jenkins.username'), {
    target: { value: 'builder14' },
  })
  fireEvent.change(screen.getByLabelText('API Token'), { target: { value: 'token14' } })
  fireEvent.click(screen.getByRole('button', { name: 'jenkins.save' }))
  await waitFor(() =>
    expect(apiSaveJenkinsSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^[a-f0-9]{12}$/),
        name: '河南 14',
        revision: 0,
      }),
    ),
  )
  fireEvent.change(screen.getByLabelText('jenkins.connection'), {
    target: { value: 'default' },
  })
  expect(screen.getByLabelText('jenkins.url')).toHaveValue(connection.baseUrl)
})
