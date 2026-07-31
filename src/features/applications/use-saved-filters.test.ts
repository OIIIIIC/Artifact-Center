import { afterEach, describe, expect, it } from 'vitest'

import {
  mergeFiltersWithSavedPrefs,
  readSavedFilterPrefs,
  writeSavedFilterPrefs,
} from './use-saved-filters'

describe('use-saved-filters', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('默认偏好为全部平台 + 最近更新', () => {
    expect(readSavedFilterPrefs()).toEqual({ platform: 'all', sort: 'updated' })
  })

  it('可读写个人偏好且不接受非法枚举', () => {
    writeSavedFilterPrefs({ platform: 'android', sort: 'name' })
    expect(readSavedFilterPrefs()).toEqual({ platform: 'android', sort: 'name' })

    window.localStorage.setItem(
      'artifact-center.application-filter-prefs.v1',
      JSON.stringify({ platform: 'ios', sort: 'bogus' }),
    )
    expect(readSavedFilterPrefs()).toEqual({ platform: 'all', sort: 'updated' })
  })

  it('URL 已有参数时不覆盖；缺失时用本地偏好', () => {
    const prefs = { platform: 'windows' as const, sort: 'created' as const }
    const base = { query: '', platform: 'all' as const, sort: 'updated' as const }

    const withUrl = mergeFiltersWithSavedPrefs(
      { ...base, platform: 'android', sort: 'name' },
      new URLSearchParams('platform=android&sort=name'),
      prefs,
    )
    expect(withUrl.platform).toBe('android')
    expect(withUrl.sort).toBe('name')

    const withoutUrl = mergeFiltersWithSavedPrefs(base, new URLSearchParams(), prefs)
    expect(withoutUrl.platform).toBe('windows')
    expect(withoutUrl.sort).toBe('created')
  })
})
