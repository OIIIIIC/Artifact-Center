import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceFilterPreferenceSync } from './use-workspace-filter-preference-sync'
import type { PersonalWorkspacePreferences } from '@/services/api'

const current: PersonalWorkspacePreferences = {
  query: '',
  platform: 'all',
  sort: 'updated',
  regionId: null,
  favoriteOnly: false,
  responsibleOnly: false,
  collapsed: false,
}
const currentSnapshot = {
  query: current.query,
  platform: current.platform,
  sort: current.sort,
  regionId: current.regionId,
  favoriteOnly: current.favoriteOnly,
  responsibleOnly: current.responsibleOnly,
}

afterEach(() => {
  vi.useRealTimers()
})

describe('工作台筛选偏好同步', () => {
  it('搜索词尚在延迟窗口时离开页面也会提交最新状态', () => {
    vi.useFakeTimers()
    const onPersist = vi.fn()
    const next = { ...currentSnapshot, query: '终端' }
    const { unmount } = renderHook(() =>
      useWorkspaceFilterPreferenceSync({
        current,
        next,
        loading: false,
        onPersist,
      }),
    )

    unmount()

    expect(onPersist).toHaveBeenCalledTimes(1)
    expect(onPersist).toHaveBeenCalledWith(next)
  })

  it('连续输入只提交最后一个搜索词', () => {
    vi.useFakeTimers()
    const onPersist = vi.fn()
    const { rerender } = renderHook(
      ({ query }) =>
        useWorkspaceFilterPreferenceSync({
          current,
          next: { ...currentSnapshot, query },
          loading: false,
          onPersist,
        }),
      { initialProps: { query: '终' } },
    )

    rerender({ query: '终端' })
    vi.advanceTimersByTime(350)

    expect(onPersist).toHaveBeenCalledTimes(1)
    expect(onPersist).toHaveBeenCalledWith({ ...currentSnapshot, query: '终端' })
  })
})
