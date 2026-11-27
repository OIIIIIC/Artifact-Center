import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StartBuildDialog, PublishBuildDialog } from './build-dialogs'
import { BuildLog } from './build-log'
import {
  apiStartBuild,
  apiPublishBuild,
  apiBuildLog,
  type BuildRun,
} from '@/services/api/builds'

vi.mock('@/services/api/builds', () => ({
  apiStartBuild: vi.fn(),
  apiPublishBuild: vi.fn(),
  apiBuildLog: vi.fn(),
}))
const t = (key: string) => key
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))
const config = {
  enabled: true,
  jobPath: 'henan',
  artifactPattern: '**/*.tar.gz',
  parameters: [{ name: 'buildMode', value: 'test' }],
  revision: 2,
}
const run = {
  id: 'run-1',
  applicationId: 'app-1',
  jobPath: 'henan',
  buildNumber: 41,
  commits: ['abc1234567'],
  status: 'success',
} as BuildRun
beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.unstubAllGlobals())

it.each(['HTTPS', 'HTTP'])(
  '%s 重复请求保留幂等编号；参数变化后生成新编号',
  async (origin) => {
    if (origin === 'HTTP') {
      const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
      vi.stubGlobal('crypto', { getRandomValues })
    }
    vi.mocked(apiStartBuild).mockRejectedValue(new TypeError('offline'))
    render(
      <StartBuildDialog
        appId="app-1"
        config={config}
        hasUnknown={false}
        onClose={vi.fn()}
        onStarted={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'builds.start' }))
    await screen.findByRole('alert')
    const first = vi.mocked(apiStartBuild).mock.calls[0][1]
    expect(first.requestKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    fireEvent.click(screen.getByRole('button', { name: 'builds.start' }))
    await waitFor(() => expect(apiStartBuild).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'builds.start' })).toBeEnabled(),
    )
    expect(vi.mocked(apiStartBuild).mock.calls[1][1].requestKey).toBe(first.requestKey)
    fireEvent.change(screen.getByLabelText('buildMode'), { target: { value: 'prod' } })
    fireEvent.click(screen.getByRole('button', { name: 'builds.start' }))
    await waitFor(() => expect(apiStartBuild).toHaveBeenCalledTimes(3))
    expect(vi.mocked(apiStartBuild).mock.calls[2][1]).toMatchObject({
      configRevision: 2,
      parameters: [{ name: 'buildMode', value: 'prod' }],
    })
    expect(vi.mocked(apiStartBuild).mock.calls[2][1].requestKey).not.toBe(
      first.requestKey,
    )
  },
)
it('存在结果未确认的构建时需明确勾选后才能提交', () => {
  render(
    <StartBuildDialog
      appId="app-1"
      config={config}
      hasUnknown
      onClose={vi.fn()}
      onStarted={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'builds.start' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(screen.getByRole('button', { name: 'builds.start' })).toBeEnabled()
  expect(apiStartBuild).not.toHaveBeenCalled()
})
it('使用 Jenkins 选项渲染下拉框，只提交选择的参数值', async () => {
  vi.mocked(apiStartBuild).mockResolvedValue({ build: run })
  render(
    <StartBuildDialog
      appId="app-1"
      config={{
        ...config,
        parameterChoices: [{ name: 'buildMode', choices: ['dev', 'test', 'prod'] }],
      }}
      hasUnknown={false}
      onClose={vi.fn()}
      onStarted={vi.fn()}
    />,
  )
  const selector = screen.getByRole('combobox', { name: 'buildMode' })
  expect(selector).toHaveValue('test')
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    'dev',
    'test',
    'prod',
  ])
  fireEvent.change(selector, { target: { value: 'prod' } })
  fireEvent.click(screen.getByRole('button', { name: 'builds.start' }))
  await waitFor(() =>
    expect(apiStartBuild).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        parameters: [{ name: 'buildMode', value: 'prod' }],
      }),
    ),
  )
})
it('发布默认测试版；正式版必须确认且绑定精确构建与文件', async () => {
  const done = vi.fn()
  vi.mocked(apiPublishBuild).mockResolvedValue({ publication: {} } as Awaited<
    ReturnType<typeof apiPublishBuild>
  >)
  render(
    <PublishBuildDialog
      run={run}
      file={{ fileName: 'app.tar.gz', relativePath: 'out/app.tar.gz' }}
      onClose={vi.fn()}
      onPublished={done}
    />,
  )
  expect(screen.getByLabelText('builds.channel')).toHaveValue('beta')
  fireEvent.change(screen.getByLabelText('builds.version'), {
    target: { value: '1.2.3' },
  })
  fireEvent.change(screen.getByLabelText('builds.channel'), {
    target: { value: 'stable' },
  })
  expect(screen.getByRole('button', { name: 'builds.publish' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'builds.publish' }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
  expect(apiPublishBuild).toHaveBeenCalledWith('app-1', 'run-1', {
    relativePath: 'out/app.tar.gz',
    version: '1.2.3',
    channel: 'stable',
    releaseNotes: '',
    confirmStable: true,
  })
})
it('日志按文本渲染，刷新继续使用服务端游标，离开页签停止请求', async () => {
  vi.mocked(apiBuildLog)
    .mockResolvedValueOnce({
      text: '<script>alert(1)</script>',
      nextStart: 99,
      more: false,
      truncated: true,
    })
    .mockResolvedValue({
      text: '\nSUCCESS',
      nextStart: 107,
      more: false,
      truncated: false,
    })
  const view = render(<BuildLog run={run} active />)
  await screen.findByText('<script>alert(1)</script>')
  expect(view.container.querySelector('script')).toBeNull()
  expect(screen.getByText('builds.logTruncated')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'builds.refresh' }))
  await waitFor(() =>
    expect(apiBuildLog).toHaveBeenCalledWith(
      'app-1',
      'run-1',
      99,
      expect.any(AbortSignal),
    ),
  )
  await screen.findByText(/SUCCESS/)
  view.rerender(<BuildLog run={run} active={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'builds.refresh' }))
  expect(apiBuildLog).toHaveBeenCalledTimes(2)
})

it('隐藏真实 Jenkins 控制标记，并等待跨响应的标记完整后展示后续日志', async () => {
  const esc = String.fromCharCode(27)
  vi.mocked(apiBuildLog)
    .mockResolvedValueOnce({
      text: `Started\n${esc}[8mha:partial-metadata`,
      nextStart: 40,
      more: false,
      truncated: false,
    })
    .mockResolvedValueOnce({
      text: `-continued${esc}[0m${esc}[32mSUCCESS${esc}[0m <b>text</b>`,
      nextStart: 100,
      more: false,
      truncated: false,
    })
  const view = render(<BuildLog run={run} active />)
  await screen.findByText('Started')
  const log = screen.getByLabelText('builds.log')
  expect(log.textContent).not.toContain('metadata')
  fireEvent.click(screen.getByRole('button', { name: 'builds.refresh' }))
  await screen.findByText(/SUCCESS/)
  expect(log.textContent).toBe('Started\nSUCCESS <b>text</b>')
  expect(view.container.querySelector('b')).toBeNull()
  expect(vi.mocked(apiBuildLog).mock.calls[1][2]).toBe(40)
})
