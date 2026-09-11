import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import * as api from '@/services/api'
import type { Product, Project } from '@/types/application'
import { ProductsWorkspace } from './products-workspace'

vi.mock('@/services/api', () => ({
  apiListRegions: vi.fn(),
  apiListProjects: vi.fn(),
  apiDirectorySummary: vi.fn(),
  apiCreateProject: vi.fn(),
  apiUpdateProject: vi.fn(),
  apiReorderProjects: vi.fn(),
  apiDeleteProject: vi.fn(),
  apiCreateRegion: vi.fn(),
  apiUpdateRegion: vi.fn(),
  apiDeleteRegion: vi.fn(),
}))

const products: Product[] = ['开封', '三沙'].map((name, index) => ({
  id: `p${index}`,
  name,
  code: `code${index}`,
  enabled: true,
  sortOrder: index,
  createdAt: '',
  updatedAt: '',
}))
let projects: Project[]

beforeEach(() => {
  vi.clearAllMocks()
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  projects = products.flatMap((p) =>
    [0, 1].map((index) => ({
      id: `${p.id}-j${index}`,
      productId: p.id,
      name: index ? '一期交付' : '默认项目',
      enabled: true,
      isDefault: !index,
      sortOrder: index,
      createdAt: '',
      updatedAt: '',
    })),
  )
  vi.mocked(api.apiListRegions).mockResolvedValue(products)
  vi.mocked(api.apiListProjects).mockImplementation(async () => [...projects])
  vi.mocked(api.apiDirectorySummary).mockResolvedValue({
    total: 0,
    productCounts: {},
    projectCounts: {},
    maintainableCounts: {},
  })
  vi.mocked(api.apiCreateProject).mockImplementation(async (productId, body) => {
    const project: Project = {
      ...projects[0],
      id: 'created-project',
      productId,
      name: body.name,
      isDefault: false,
      sortOrder: 2,
    }
    projects = [...projects, project]
    return project
  })
  vi.mocked(api.apiUpdateProject).mockImplementation(async (id, body) => {
    projects = projects.map((p) => (p.id === id ? { ...p, ...body } : p))
    return projects.find((p) => p.id === id)!
  })
})

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Location() {
    const location = useLocation(),
      navigate = useNavigate()
    return (
      <>
        <output aria-label="当前地址">{location.search}</output>
        <button onClick={() => navigate(-1)}>返回上个产品</button>
      </>
    )
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/products?product=p0']}>
        <ProductsWorkspace />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('产品管理连续维护', () => {
  it('切换产品保留草稿，返回恢复选中产品，新增保存到正确产品', async () => {
    renderWorkspace()
    await screen.findByRole('button', { name: '新建项目' })
    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
      target: { value: '现场联调' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^三沙/ }))
    expect(screen.queryByRole('textbox', { name: '项目名称' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('当前地址')).toHaveTextContent('product=p1')
    fireEvent.click(screen.getByRole('button', { name: '返回上个产品' }))
    expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveValue('现场联调')
    fireEvent.submit(screen.getByRole('form', { name: '新建项目' }))
    await screen.findByRole('button', { name: '重命名项目 现场联调' })
    const createdRow = screen
      .getByRole('button', { name: '重命名项目 现场联调' })
      .closest('li')!
    expect(within(createdRow).getByRole('link', { name: '0 个应用' })).toHaveAttribute(
      'href',
      '/?product=p0&project=created-project',
    )
    expect(api.apiCreateProject).toHaveBeenCalledWith('p0', {
      name: '现场联调',
      sortOrder: 2,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('重命名只保存名称；保存失败保留输入并显示原因', async () => {
    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: '重命名项目 一期交付' }))
    fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
      target: { value: '二期交付' },
    })
    vi.mocked(api.apiUpdateProject).mockRejectedValueOnce({ code: 'project_taken' })
    fireEvent.submit(screen.getByRole('form', { name: '重命名项目' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveValue('二期交付')
    expect(screen.getByRole('alert')).toHaveTextContent('已存在同名项目')
    fireEvent.submit(screen.getByRole('form', { name: '重命名项目' }))
    await screen.findByRole('button', { name: '重命名项目 二期交付' })
    expect(api.apiUpdateProject).toHaveBeenLastCalledWith('p0-j1', { name: '二期交付' })
  })

  it('键盘排序失败恢复原顺序，不把其他产品的项目发给接口', async () => {
    renderWorkspace()
    const grip = await screen.findByRole('button', { name: '调整 一期交付 的排序' })
    let rejectOrder!: (reason: unknown) => void
    vi.mocked(api.apiReorderProjects).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectOrder = reject
        }),
    )
    fireEvent.keyDown(grip, { key: 'ArrowUp' })
    await waitFor(() =>
      expect(api.apiReorderProjects).toHaveBeenCalledWith(
        'p0',
        ['p0-j1', 'p0-j0'],
        ['p0-j0', 'p0-j1'],
      ),
    )
    const region = screen.getByRole('region', { name: '项目' })
    const rowNames = () =>
      within(region)
        .getAllByRole('listitem')
        .map((row) => row.getAttribute('data-project-id'))
    expect(rowNames()).toEqual(['p0-j1', 'p0-j0'])
    rejectOrder({ code: 'project_order_changed' })
    await waitFor(() => expect(rowNames()).toEqual(['p0-j0', 'p0-j1']))
  })
})
