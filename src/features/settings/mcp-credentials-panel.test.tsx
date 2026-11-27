import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { request } from '@/services/http'
import { copyText } from '@/lib/clipboard'
import { McpCredentialsPanel } from './mcp-credentials-panel'

vi.mock('@/services/http', async (original) => ({
  ...(await original<typeof import('@/services/http')>()),
  API_BASE_URL: '/api',
  request: vi.fn(),
}))
vi.mock('@/lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('react-i18next', async (original) => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))
const credential = {
  id: 'device-1',
  name: 'Device',
  expiresAt: '2099-01-01',
  revokedAt: null,
}
beforeEach(() => {
  vi.clearAllMocks()
})
const show = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <McpCredentialsPanel />
    </QueryClientProvider>,
  )

it('创建后仅本次显示安装命令，可复制并主动隐藏秘密', async () => {
  vi.mocked(request).mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { token: 'acmt_private_test' } : { items: [] },
  )
  show()
  await screen.findByText('mcp.empty')
  expect(screen.queryByLabelText('mcp.setup')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('mcp.days'), { target: { value: '30' } })
  fireEvent.click(screen.getByRole('button', { name: 'mcp.create' }))
  expect(await screen.findByLabelText('mcp.setup')).toHaveTextContent('acmt_private_test')
  expect(request).toHaveBeenCalledWith('/account/mcp-credentials', {
    method: 'POST',
    body: { name: 'Codex', validDays: 30 },
  })
  fireEvent.click(screen.getByRole('button', { name: 'mcp.copy' }))
  await waitFor(() =>
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('Get-FileHash')),
  )
  expect(vi.mocked(copyText).mock.calls[0][0]).toContain('codex mcp add artifact-center')
  fireEvent.click(screen.getByRole('button', { name: 'mcp.saved' }))
  expect(screen.queryByLabelText('mcp.setup')).not.toBeInTheDocument()
})

it('撤销绑定设备后刷新列表', async () => {
  let revoked = false
  vi.mocked(request).mockImplementation(async (_path, options) => {
    if (options?.method === 'DELETE') {
      revoked = true
      return { ok: true }
    }
    return { items: [{ ...credential, revokedAt: revoked ? '2026-10-20' : null }] }
  })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'mcp.revoke' }))
  await screen.findByText('mcp.revoked')
  expect(request).toHaveBeenCalledWith('/account/mcp-credentials/device-1', {
    method: 'DELETE',
  })
})

it('读取凭据失败时显示错误，不展示秘密或空列表', async () => {
  vi.mocked(request).mockRejectedValue(new Error('offline'))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('mcp.failed')
  expect(screen.queryByLabelText('mcp.setup')).not.toBeInTheDocument()
  expect(screen.queryByText('mcp.empty')).not.toBeInTheDocument()
})
