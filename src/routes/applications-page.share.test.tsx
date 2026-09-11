import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import '@/i18n'
import { useAuthStore } from '@/store/auth-store'
import type { Application, Product, Project } from '@/types/application'
import { ApplicationsPage } from './applications-page'

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  catalog: vi.fn(),
  create: vi.fn(),
  tree: vi.fn(),
}))
vi.mock('@/services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/api')>()),
  apiApplicationPage: mocks.page,
  apiListApplications: mocks.catalog,
  apiCreateShareCollection: mocks.create,
}))
vi.mock('@/lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('@/components/layout', () => ({
  AppLayout: ({
    children,
    sidebarDirectory,
  }: {
    children: ReactNode
    sidebarDirectory: ReactNode
  }) => (
    <>
      {sidebarDirectory}
      {children}
    </>
  ),
  PageContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/features/products/application-directory', () => ({
  ApplicationDirectory: ({
    directory,
  }: {
    directory: { onSelect: (product: string, project?: string) => void }
  }) => {
    mocks.tree()
    return (
      <>
        <button onClick={() => directory.onSelect('p1', 'henan')}>选择河南项目</button>
        <button onClick={() => directory.onSelect('p1', 'xiaogan')}>选择孝感项目</button>
        <button onClick={() => directory.onSelect('p1')}>选择产品</button>
      </>
    )
  },
}))
vi.mock('@/features/products/product-directory', () => ({ CompactDirectory: () => null }))
vi.mock('@/features/applications/application-timeline', () => ({
  ApplicationTimeline: () => null,
}))
vi.mock('@/features/applications/use-applications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/applications/use-applications')>()),
  useApplications: () => ({
    filtered: [],
    filters: { query: '', platform: 'all', sort: 'updated' },
    setFilters: vi.fn(),
    total: 0,
    pagination: {},
  }),
}))
vi.mock('@/features/regions/use-regions', () => ({
  useRegions: () => ({ regions: [product] }),
}))
vi.mock('@/features/products/use-projects', () => ({ useProjects: () => ({ projects }) }))
vi.mock('@/features/applications/use-directory-summary', () => ({
  useDirectorySummary: () => ({
    data: {
      total: 26,
      productCounts: { p1: 26 },
      projectCounts: { henan: 25, xiaogan: 1 },
      maintainableCounts: { p1: 26 },
    },
  }),
}))
vi.mock('@/features/applications/use-personal-workspace', () => ({
  usePersonalWorkspace: () => ({
    workspace: { preferences: {} },
    favoriteIds: new Set(),
  }),
}))
vi.mock('@/features/applications/use-workspace-filter-preference-sync', () => ({
  useWorkspaceFilterPreferenceSync: () => {},
}))

const product = { id: 'p1', name: '智慧业务平台' } as Product
const projects = [
  { id: 'henan', productId: 'p1', name: '河南省项目' },
  { id: 'xiaogan', productId: 'p1', name: '孝感项目' },
] as Project[]
const henanApps = Array.from({ length: 25 }, (_, index) => ({
  id: `henan-${index + 1}`,
  name: `河南应用${index + 1}`,
  region: product,
  projectId: 'henan',
  latestVersion: '1.0.0',
  artifactCount: 1,
  status: 'active',
  accessRole: 'admin',
})) as Application[]
const xiaoganApp = {
  ...henanApps[0],
  id: 'xiaogan-1',
  name: '孝感医护屏',
  projectId: 'xiaogan',
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 'share-test', role: 'admin' } as never })
  mocks.catalog.mockResolvedValue([...henanApps, xiaoganApp])
  mocks.create.mockResolvedValue({ token: 'collection-token' })
  mocks.page.mockReset().mockImplementation(async ({ project, cursor, limit }) => {
    const apps =
      project === 'henan'
        ? henanApps
        : project === 'xiaogan'
          ? [xiaoganApp]
          : [...henanApps, xiaoganApp]
    const offset = cursor ? 20 : 0
    return {
      items: apps.slice(offset, offset + limit),
      total: apps.length,
      nextCursor: apps.length > offset + limit ? 'page-2' : null,
    }
  })
})
afterEach(cleanup)

function renderPage(search = '?product=p1&project=henan') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/applications${search}`]}>
        <ApplicationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it('分享从当前项目读取首批候选，标题跟随项目，且不加载全量目录或重渲染目录树', async () => {
  renderPage()
  expect(mocks.page).not.toHaveBeenCalled()
  const treeRenders = mocks.tree.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: '分享项目应用' }))
  const dialog = screen.getByRole('dialog', { name: '创建项目分享清单' })
  expect(within(dialog).getByRole('textbox', { name: '清单名称' })).toHaveValue(
    '河南省项目安装包',
  )
  expect(
    await within(dialog).findByRole('checkbox', { name: /河南应用1\s*v/ }),
  ).toBeInTheDocument()
  expect(within(dialog).queryByText('孝感医护屏')).not.toBeInTheDocument()
  expect(within(dialog).getAllByRole('checkbox')).toHaveLength(20)
  expect(mocks.page).toHaveBeenCalledWith(
    expect.objectContaining({
      product: 'p1',
      project: 'henan',
      shareable: '1',
      limit: 20,
    }),
    expect.any(AbortSignal),
  )
  expect(mocks.catalog).not.toHaveBeenCalled()
  expect(mocks.tree).toHaveBeenCalledTimes(treeRenders)
})

it('产品节点可跨其项目分页选择，项目节点不带入兄弟项目', async () => {
  renderPage('?product=p1')
  fireEvent.click(screen.getByRole('button', { name: '分享产品应用' }))
  const dialog = screen.getByRole('dialog', { name: '创建产品分享清单' })
  await within(dialog).findByRole('checkbox', { name: /河南应用1\s*v/ })
  expect(mocks.page.mock.calls[0][0]).toMatchObject({ product: 'p1', project: undefined })
  fireEvent.click(within(dialog).getByRole('button', { name: '下一页' }))
  expect(await within(dialog).findByText('孝感医护屏')).toBeInTheDocument()
})

it('后续页应用可以分享，保留前页选择及版本模式，只提交选中的应用', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: '分享项目应用' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(await within(dialog).findByRole('checkbox', { name: /河南应用1\s*v/ }))
  fireEvent.click(within(dialog).getAllByRole('button', { name: '跟随最新' })[0])
  fireEvent.click(within(dialog).getByRole('button', { name: '下一页' }))
  fireEvent.click(await within(dialog).findByRole('checkbox', { name: /河南应用25\s*v/ }))
  expect(within(dialog).getAllByRole('checkbox')).toHaveLength(5)
  fireEvent.click(within(dialog).getByRole('button', { name: '生成并复制清单链接' }))
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith({
      title: '河南省项目安装包',
      regionId: 'p1',
      expiresInDays: 7,
      items: [
        { applicationId: 'henan-1', mode: 'latest' },
        { applicationId: 'henan-25', mode: 'artifact' },
      ],
    }),
  )
})

it('选择本页遵守总计 20 项上限，清空后仍可选择后续页', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: '分享项目应用' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(await within(dialog).findByRole('button', { name: '选择本页' }))
  expect(within(dialog).getByText('已选 20 个')).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: '下一页' }))
  const checkbox = await within(dialog).findByRole('checkbox', { name: /河南应用25\s*v/ })
  expect(checkbox).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: '选择本页' })).toBeDisabled()
  fireEvent.click(within(dialog).getByRole('button', { name: '清空' }))
  fireEvent.click(checkbox)
  expect(within(dialog).getByText('已选 1 个')).toBeInTheDocument()
})

it('切换节点后重置候选、名称和选择，重复打开也不残留旧选择', async () => {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: '分享项目应用' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: /河南应用1\s*v/ }))
  fireEvent.click(screen.getByRole('button', { name: '关闭' }))
  fireEvent.click(screen.getByRole('button', { name: '选择孝感项目' }))
  fireEvent.click(screen.getByRole('button', { name: '分享项目应用' }))
  const dialog = screen.getByRole('dialog')
  expect(
    await within(dialog).findByRole('checkbox', { name: /孝感医护屏/ }),
  ).toHaveAttribute('aria-checked', 'false')
  expect(within(dialog).getAllByRole('checkbox')).toHaveLength(1)
  expect(within(dialog).getByRole('textbox')).toHaveValue('孝感项目安装包')
  expect(within(dialog).getByText('已选 0 个')).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
  fireEvent.click(screen.getByRole('button', { name: '分享项目应用' }))
  expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false')
})

it('立即展示加载状态，请求失败可重试，空项目不回退到整个产品', async () => {
  let fail!: (error: Error) => void
  mocks.page.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        fail = reject
      }),
  )
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: '分享项目应用' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('status')).toBeInTheDocument()
  fail(new Error('offline'))
  expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
  mocks.page.mockResolvedValueOnce({ items: [], total: 0, nextCursor: null })
  fireEvent.click(within(dialog).getByRole('button', { name: '重试' }))
  expect(
    await within(dialog).findByText('当前目录暂无可分享的应用版本。'),
  ).toBeInTheDocument()
  expect(
    within(dialog).getByRole('button', { name: '生成并复制清单链接' }),
  ).toBeDisabled()
  expect(mocks.catalog).not.toHaveBeenCalled()
  expect(mocks.page).toHaveBeenCalledTimes(2)
})

it('无效项目不显示产品级分享入口', () => {
  renderPage('?product=p1&project=missing')
  expect(screen.queryByRole('button', { name: /分享.*应用/ })).not.toBeInTheDocument()
})
