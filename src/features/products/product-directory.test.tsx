import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { Product, Project } from '@/types/application'
import { CompactDirectory, ProductDirectory } from './product-directory'

const product = (id: string, name: string): Product => ({
  id,
  name,
  code: id,
  enabled: true,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
})
const products = [product('p1', '开封'), product('p2', '三沙')]
const projects: Project[] = [
  {
    id: 'j1',
    productId: 'p1',
    name: '默认项目',
    enabled: true,
    isDefault: true,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'j2',
    productId: 'p2',
    name: '演示验证',
    enabled: true,
    isDefault: false,
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
]

describe('主侧栏应用目录', () => {
  it('首次仅创建产品行，展开后保留分支内容以完成收起动画', () => {
    render(
      <ProductDirectory
        products={products}
        projects={projects}
        productId="all"
        projectId="all"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.queryAllByText('全部项目')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: '展开 开封' }))
    expect(screen.getAllByText('全部项目')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '收起 开封' }))
    expect(screen.getAllByText('全部项目')).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: /^默认项目\s?0$/ }),
    ).not.toBeInTheDocument()
  })
  it('展开只改变目录；点击产品或项目才改变筛选', () => {
    const onSelect = vi.fn()
    render(
      <ProductDirectory
        products={products}
        projects={projects}
        applications={[]}
        productId="all"
        projectId="all"
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '展开 开封' }))
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^默认项目\s?0$/ }))
    expect(onSelect).toHaveBeenLastCalledWith('p1', 'j1')
    fireEvent.click(screen.getByRole('button', { name: /^三沙\s?0$/ }))
    expect(onSelect).toHaveBeenLastCalledWith('p2')
    expect(screen.getByRole('button', { name: '收起 三沙' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('button', { name: '展开 开封' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('从浏览器历史恢复项目时展开所属产品，折叠内容不进入可访问树', () => {
    const props = { products, projects, applications: [], onSelect: vi.fn() }
    const { rerender } = render(
      <ProductDirectory {...props} productId="p1" projectId="j1" />,
    )
    expect(screen.getByRole('button', { name: /^默认项目\s?0$/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    rerender(<ProductDirectory {...props} productId="p2" projectId="j2" />)
    expect(screen.getByRole('button', { name: /^演示验证\s?0$/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.queryByRole('button', { name: /^默认项目\s?0$/ })).toBeNull()
  })

  it('手机切换产品会重置项目，并只显示该产品的项目', () => {
    function Harness() {
      const [scope, setScope] = useState(['p1', 'j1'])
      return (
        <CompactDirectory
          products={products}
          projects={projects}
          applications={[]}
          productId={scope[0]}
          projectId={scope[1]}
          onSelect={(p, j = 'all') => setScope([p, j])}
        />
      )
    }
    render(<Harness />)
    fireEvent.change(screen.getByRole('combobox', { name: '产品' }), {
      target: { value: 'p2' },
    })
    const select = screen.getByRole('combobox', { name: '项目' })
    expect(select).toHaveValue('all')
    expect(within(select).queryByRole('option', { name: '默认项目' })).toBeNull()
    expect(within(select).getByRole('option', { name: '演示验证' })).toBeInTheDocument()
  })
})
