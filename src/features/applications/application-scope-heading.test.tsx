import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { ApplicationScopeHeading } from './application-scope-heading'
import { ApplicationScopePath } from './application-scope-path'

const product = { id: 'tianjin', name: '天津' }
const project = { id: 'mobile', productId: 'tianjin', name: '移动端项目' }
const counts = {
  total: 18,
  productCounts: { tianjin: 5 },
  projectCounts: { mobile: 2 },
  maintainableCounts: {},
}
const defaults = {
  productId: 'all',
  projectId: 'all',
  product,
  project,
  counts,
  loading: false,
  error: false,
  onSelect: vi.fn(),
}
afterEach(cleanup)

describe('应用目录标题', () => {
  it('跟随全部应用、产品和子项目切换名称与对应数量', () => {
    const { rerender } = render(<ApplicationScopeHeading {...defaults} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('全部应用')
    expect(screen.getByText('18 个应用')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    rerender(<ApplicationScopeHeading {...defaults} productId="tianjin" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('天津')
    expect(screen.getByText('5 个应用')).toBeInTheDocument()
    expect(screen.queryByText('18 个应用')).not.toBeInTheDocument()
    rerender(
      <ApplicationScopeHeading {...defaults} productId="tianjin" projectId="mobile" />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('移动端项目')
    expect(screen.getByText('2 个应用')).toBeInTheDocument()
  })
  it('子项目路径允许返回所属产品或全部应用', () => {
    const onSelect = vi.fn()
    render(
      <ApplicationScopePath
        {...defaults}
        productId="tianjin"
        projectId="mobile"
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '天津' }))
    expect(onSelect).toHaveBeenLastCalledWith('tianjin')
    fireEvent.click(screen.getByRole('button', { name: '全部应用' }))
    expect(onSelect).toHaveBeenLastCalledWith('all')
  })
  it('返回上级逐层返回，根目录不显示路径', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <ApplicationScopePath
        {...defaults}
        productId="tianjin"
        projectId="mobile"
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '返回上级' }))
    expect(onSelect).toHaveBeenLastCalledWith('tianjin')
    expect(screen.getByText('移动端项目')).toHaveAttribute('aria-current', 'page')
    rerender(
      <ApplicationScopePath {...defaults} productId="tianjin" onSelect={onSelect} />,
    )
    fireEvent.click(await screen.findByRole('button', { name: '返回上级' }))
    expect(onSelect).toHaveBeenLastCalledWith('all')
    rerender(<ApplicationScopePath {...defaults} onSelect={onSelect} />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
  it('真实空目录显示 0，而不是回退为全局数量', () => {
    render(
      <ApplicationScopeHeading
        {...defaults}
        productId="tianjin"
        projectId="empty"
        project={{ ...project, id: 'empty', name: '空项目' }}
      />,
    )
    expect(screen.getByText('0 个应用')).toBeInTheDocument()
  })
  it.each([
    { loading: true, error: false },
    { loading: false, error: true },
  ])('加载或失败时不把未知数量显示成 0：%j', (state) => {
    render(
      <ApplicationScopeHeading
        {...defaults}
        {...state}
        counts={undefined}
        productId="tianjin"
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('天津')
    expect(screen.queryByText(/\d+ 个应用/)).not.toBeInTheDocument()
  })
  it('无效项目或跨产品项目不冒充有效目录', () => {
    render(
      <ApplicationScopeHeading
        {...defaults}
        productId="tianjin"
        projectId="mobile"
        project={{ ...project, productId: 'suzhou' }}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('目录不可用')
    expect(screen.queryByText(/\d+ 个应用/)).not.toBeInTheDocument()
  })
})
