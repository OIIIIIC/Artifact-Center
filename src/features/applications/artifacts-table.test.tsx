import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { ArtifactsTable } from './artifacts-table'
import type { Artifact } from '@/types/artifact'

vi.mock('@/services/api', () => ({
  apiDeleteArtifact: vi.fn(),
  apiUpdateArtifact: vi.fn(),
}))
const artifact: Artifact = {
  id: 'artifact-1',
  applicationId: 'app-1',
  version: '1.0.0',
  buildNumber: '1',
  platform: 'android',
  sizeBytes: 123,
  uploadedAt: '2026-09-10T00:00:00Z',
  uploader: '测试',
  status: 'beta',
  channel: 'beta',
  releaseNotes: '',
  filename: 'test.apk',
}
afterEach(cleanup)
function mount() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <button>外部按钮</button>
      <ArtifactsTable
        canManage
        artifacts={[artifact, { ...artifact, id: 'artifact-2', version: '2.0.0' }]}
      />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}
describe('制品操作菜单', () => {
  it('点击菜单外部关闭，并允许外部按钮正常获得焦点', async () => {
    const user = mount()
    await user.click(screen.getAllByRole('button', { name: '更多操作' })[0])
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '外部按钮' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '外部按钮' })).toHaveFocus()
  })
  it('Escape 关闭并把焦点还给原按钮', async () => {
    const user = mount()
    const trigger = screen.getAllByRole('button', { name: '更多操作' })[0]
    await user.click(trigger)
    await user.tab()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
  it('内部删除确认不被误关，取消返回菜单，切换行不残留旧确认', async () => {
    const user = mount()
    const triggers = screen.getAllByRole('button', { name: '更多操作' })
    await user.click(triggers[0])
    await user.click(screen.getByRole('menuitem', { name: '删除此版本' }))
    await user.click(
      within(screen.getByRole('menu')).getByRole('button', { name: '取消' }),
    )
    expect(screen.getByRole('menuitem', { name: '删除此版本' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: '删除此版本' }))
    await user.click(triggers[1])
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(screen.getByRole('menuitem', { name: '删除此版本' })).toBeInTheDocument()
    await user.click(triggers[1])
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
