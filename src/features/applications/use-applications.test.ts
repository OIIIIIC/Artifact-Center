import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  useApplications,
  parseApplicationFilters,
  writeApplicationFilters,
} from './use-applications'
import type { Application } from '@/types/application'

const listApplications = vi.fn()

vi.mock('@/services/api', () => ({
  apiListApplications: (...args: unknown[]) => listApplications(...args),
}))

const application: Application = {
  id: 'app-1',
  name: '移动银行',
  applicationCode: 'mobile-bank',
  description: '',
  packageName: 'com.example.bank',
  platform: 'android',
  region: {
    id: 'region-1',
    code: 'henan',
    name: '河南',
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
  },
  latestVersion: '1.0.0',
  updatedAt: '2026-08-11T00:00:00.000Z',
  createdAt: '2026-08-11T00:00:00.000Z',
  owner: '管理员',
  artifactCount: 1,
  status: 'active',
  repository: '',
}

const androidApplication: Application = {
  ...application,
  id: 'app-android',
  name: '移动银行 Android',
}

afterEach(() => {
  window.localStorage.clear()
  listApplications.mockReset()
})

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

  it('首次切换平台时保留当前列表，直到新结果到达', async () => {
    let resolveAndroid: ((value: Application[]) => void) | undefined
    listApplications.mockImplementation((params: { platform?: string }) => {
      if (params.platform === 'android') {
        return new Promise<Application[]>((resolve) => {
          resolveAndroid = resolve
        })
      }
      return Promise.resolve([application])
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        createElement(QueryClientProvider, { client: queryClient }, children),
      )
    const { result } = renderHook(() => useApplications(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    const initialTransitionKey = result.current.transitionKey
    act(() => {
      result.current.setFilters({ query: '', platform: 'android', sort: 'updated' })
    })
    await waitFor(() => expect(resolveAndroid).toBeTypeOf('function'))

    expect(result.current.loading).toBe(false)
    expect(result.current.applications).toEqual([application])
    expect(result.current.refreshing).toBe(true)
    expect(result.current.transitionKey).toBe(initialTransitionKey)

    resolveAndroid?.([androidApplication])
    await waitFor(() => expect(result.current.refreshing).toBe(false))
    expect(result.current.applications).toEqual([androidApplication])
    expect(result.current.transitionKey).not.toBe(initialTransitionKey)
  })
})
