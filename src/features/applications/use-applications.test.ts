import { describe, expect, it } from 'vitest'

import { parseApplicationFilters, writeApplicationFilters } from './use-applications'

describe('Application 列表 URL 筛选', () => {
  it('从 URL 恢复搜索、平台和排序', () => {
    const filters = parseApplicationFilters(
      new URLSearchParams('q=mobile&platform=android&sort=name'),
    )

    expect(filters).toEqual({
      query: 'mobile',
      platform: 'android',
      sort: 'name',
    })
  })

  it('非法参数回退到默认值并限制搜索长度', () => {
    const filters = parseApplicationFilters(
      new URLSearchParams({
        q: 'a'.repeat(150),
        platform: 'ios',
        sort: 'random',
      }),
    )

    expect(filters.query).toHaveLength(120)
    expect(filters.platform).toBe('all')
    expect(filters.sort).toBe('updated')
  })

  it('写入非默认筛选并保留无关参数', () => {
    const params = writeApplicationFilters(new URLSearchParams('region=cn'), {
      query: '银行',
      platform: 'android',
      sort: 'created',
    })

    expect(params.toString()).toContain('region=cn')
    expect(params.get('q')).toBe('银行')
    expect(params.get('platform')).toBe('android')
    expect(params.get('sort')).toBe('created')
  })

  it('默认筛选不会产生冗余参数', () => {
    const params = writeApplicationFilters(
      new URLSearchParams('q=old&platform=zip&sort=name'),
      {
        query: '',
        platform: 'all',
        sort: 'updated',
      },
    )

    expect(params.toString()).toBe('')
  })
})
