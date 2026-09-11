import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import '@/i18n'
import { useAuthStore } from '@/store/auth-store'
import type { Application } from '@/types/application'
import { ApplicationDirectory } from './application-directory'
import {
  applicationDirectoryHref,
  resolveDetailTab,
} from '@/features/applications/detail-navigation'

const mocks = vi.hoisted(() => ({ page: vi.fn() }))
vi.mock('@/services/api', () => ({ apiApplicationPage: mocks.page }))
vi.mock('@/features/regions/use-regions', () => ({
  useRegions: () => ({
    regions: [
      { id: 'p1', name: '开封' },
      { id: 'p2', name: '三沙' },
    ],
    refetch: vi.fn(),
  }),
}))
vi.mock('./use-projects', () => ({
  useProjects: () => ({
    projects: [
      { id: 'j1', productId: 'p1', name: '交付项目' },
      { id: 'j2', productId: 'p2', name: '演示项目' },
    ],
    refetch: vi.fn(),
  }),
}))
vi.mock('@/features/applications/use-directory-summary', () => ({
  useDirectorySummary: () => ({
    data: { total: 3, productCounts: { p1: 2, p2: 1 }, projectCounts: { j1: 2, j2: 1 } },
    refetch: vi.fn(),
  }),
}))
const app = (id: string, name: string, projectId = 'j1'): Application =>
  ({
    id,
    name,
    projectId,
    projectName: projectId === 'j1' ? '交付项目' : '演示项目',
    region: {
      id: projectId === 'j1' ? 'p1' : 'p2',
      name: projectId === 'j1' ? '开封' : '三沙',
    },
    platform: 'android',
  }) as Application
const a = app('a', '医护屏'),
  b = app('b', '看护内屏'),
  c = app('c', '看护外屏', 'j2')
let owner = 0
beforeEach(() => {
  useAuthStore.setState({ user: { id: `directory-test-${++owner}` } as never })
  mocks.page.mockReset().mockImplementation(async ({ project, q }) => ({
    items: q ? [c] : project === 'j1' ? [a, b] : [c],
    total: q ? 1 : project === 'j1' ? 2 : 1,
    nextCursor: null,
  }))
})
function Location() {
  return (
    <output data-testid="location">
      {useLocation().pathname}
      {useLocation().search}
    </output>
  )
}
function harness(current = a) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = (item: Application) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ApplicationDirectory
          application={item}
          applicationId={item.id}
          tab="artifacts"
        />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { ...render(view(current)), view }
}
it('直达时定位应用，仅加载当前展开项目；切换应用保留制品页签和缓存', async () => {
  const rendered = harness()
  expect(await screen.findByRole('link', { name: '医护屏' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const link = await screen.findByRole('link', { name: '看护内屏' })
  expect(mocks.page).toHaveBeenCalledTimes(1)
  expect(mocks.page.mock.calls[0][0]).toMatchObject({ project: 'j1', limit: 30 })
  fireEvent.click(link)
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/applications/b?tab=artifacts',
  )
  rendered.rerender(rendered.view(b))
  expect(screen.getByRole('link', { name: '看护内屏' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(mocks.page).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '收起应用目录' }))
  expect(screen.queryByRole('link', { name: '看护内屏' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '展开应用目录' }))
  expect(await screen.findByRole('link', { name: '看护内屏' })).toBeInTheDocument()
  expect(mocks.page).toHaveBeenCalledTimes(1)
})
it('展开箭头按需加载其他项目，项目名称返回筛选列表', async () => {
  harness()
  await screen.findByRole('link', { name: '看护内屏' })
  fireEvent.click(screen.getByRole('button', { name: '展开 三沙' }))
  expect(mocks.page).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '展开 演示项目' }))
  await screen.findByRole('link', { name: '看护外屏' })
  expect(mocks.page).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: /^演示项目\s*1$/ }))
  expect(screen.getByTestId('location')).toHaveTextContent('/?product=p2&project=j2')
})
it('搜索能找到未展开项目内的应用，并显示产品项目路径', async () => {
  harness()
  await screen.findByRole('link', { name: '看护内屏' })
  fireEvent.change(screen.getByRole('textbox', { name: '查找产品、项目或应用' }), {
    target: { value: '看护外屏' },
  })
  const result = await screen.findByRole('link', { name: /看护外屏.*三沙.*演示项目/ })
  expect(result).toHaveAttribute('href', '/applications/c?tab=artifacts')
  expect(mocks.page.mock.calls.at(-1)?.[0]).toMatchObject({ q: '看护外屏', limit: 30 })
})
it('当前应用不在首批结果里也能定位；加载失败可重试', async () => {
  mocks.page.mockRejectedValueOnce(new Error('offline'))
  harness(c)
  expect(await screen.findByRole('link', { name: '看护外屏' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  fireEvent.click(await screen.findByRole('button', { name: /重试/ }))
  await waitFor(() => expect(mocks.page).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByRole('button', { name: /重试/ })).toBeNull())
})
it('应用切换仅携带有效页签，不携带旧应用的编辑参数', () => {
  expect(applicationDirectoryHref('b', 'settings')).toBe('/applications/b?tab=settings')
  expect(applicationDirectoryHref('b', 'invalid')).toBe('/applications/b')
})

it('无权限的管理页签回到概览，普通页签保持不变', () => {
  expect(resolveDetailTab('settings', false)).toBe('overview')
  expect(resolveDetailTab('shares', false)).toBe('overview')
  expect(resolveDetailTab('artifacts', false)).toBe('artifacts')
})

it('后续页中的当前应用先定位，加载更多后去重且保留首批条目', async () => {
  mocks.page.mockImplementation(async ({ cursor }) => ({
    items: cursor ? [b] : [a],
    total: 2,
    nextCursor: cursor ? null : 'next',
  }))
  harness(b)
  expect(await screen.findByRole('link', { name: '看护内屏' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  fireEvent.click(await screen.findByRole('button', { name: '加载更多应用' }))
  await waitFor(() => expect(mocks.page.mock.calls.at(-1)?.[0].cursor).toBe('next'))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '加载更多应用' })).toBeNull(),
  )
  expect(screen.getAllByRole('link', { name: '看护内屏' })).toHaveLength(1)
  expect(screen.getByRole('link', { name: '医护屏' })).toBeInTheDocument()
})
