import { describe, expect, it } from 'vitest'

import { getProductNavGroups } from './product-nav'

describe('产品导航', () => {
  it('个人工作台是独立入口，并与应用目录分别高亮', () => {
    const workspaceItems = getProductNavGroups('/workspace')[0].items
    expect(workspaceItems.map((item) => item.id)).toEqual(['workspace', 'applications'])
    expect(workspaceItems.find((item) => item.id === 'workspace')?.active).toBe(true)
    expect(workspaceItems.find((item) => item.id === 'applications')?.active).toBe(false)

    expect(
      getProductNavGroups('/products', { isAdmin: true })[1].items.find(
        (item) => item.id === 'products',
      )?.active,
    ).toBe(true)
    expect(
      getProductNavGroups('/products')[1].items.some((item) => item.id === 'products'),
    ).toBe(false)
    const applicationItems = getProductNavGroups('/applications/example')[0].items
    expect(applicationItems.find((item) => item.id === 'workspace')?.active).toBe(false)
    expect(applicationItems.find((item) => item.id === 'applications')?.active).toBe(true)
  })
})
