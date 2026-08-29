import { describe, expect, it } from 'vitest'

import { buildRestoredApplicationSearch } from './workspace-filter-preferences'

describe('工作台筛选恢复', () => {
  it('恢复搜索、平台、地域、排序、收藏和负责范围', () => {
    const result = new URLSearchParams(
      buildRestoredApplicationSearch({
        query: '终端',
        platform: 'windows',
        sort: 'name',
        regionId: '00000000-0000-4000-8000-000000000010',
        favoriteOnly: true,
        responsibleOnly: true,
        collapsed: false,
      }),
    )

    expect(Object.fromEntries(result)).toEqual({
      q: '终端',
      platform: 'windows',
      sort: 'name',
      region: '00000000-0000-4000-8000-000000000010',
      favorites: '1',
      scope: 'mine',
    })
  })

  it('默认平台和排序也显式写入，避免被本机旧偏好覆盖', () => {
    expect(
      new URLSearchParams(
        buildRestoredApplicationSearch({
          query: '',
          platform: 'all',
          sort: 'updated',
          regionId: null,
          favoriteOnly: false,
          responsibleOnly: false,
          collapsed: false,
        }),
      ).toString(),
    ).toBe('platform=all&sort=updated')
  })
})
