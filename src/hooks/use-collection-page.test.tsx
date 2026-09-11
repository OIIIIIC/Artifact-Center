import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { expect, it, vi } from 'vitest'
import { useCollectionPage } from './use-collection-page'
import type { CollectionPage } from '@/services/api'

it('打开详情后返回同一浏览位置，恢复原来的页和列表', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  })
  const load = async (cursor?: string) => ({
    items: [cursor ?? 'first'],
    total: 50,
    nextCursor: cursor ? null : 'second',
  })
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  const options = { queryKey: ['restore-page'], queryFn: load, cacheKey: 'history-entry' }
  const first = renderHook(() => useCollectionPage(options), { wrapper: Wrapper })
  await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
  act(() => first.result.current.next())
  await waitFor(() => expect(first.result.current.data?.items).toEqual(['second']))
  first.unmount()
  const returned = renderHook(() => useCollectionPage(options), { wrapper: Wrapper })
  expect(returned.result.current.page).toBe(2)
  expect(returned.result.current.data?.items).toEqual(['second'])
})

it('只展示当前页，前后翻页不累积列表，筛选改变后重置游标', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  })
  const load = vi.fn(
    async (filter: string, cursor?: string): Promise<CollectionPage<string>> => ({
      items: [filter + (cursor ?? 'first')],
      total: 50,
      nextCursor: cursor ? null : 'second',
    }),
  )
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  const { result, rerender } = renderHook(
    ({ filter }) =>
      useCollectionPage({
        queryKey: ['test-page', filter],
        queryFn: (cursor) => load(filter, cursor),
      }),
    { initialProps: { filter: '产品甲' }, wrapper: Wrapper },
  )
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  act(() => result.current.next())
  await waitFor(() => expect(result.current.data?.items).toEqual(['产品甲second']))
  expect(result.current.page).toBe(2)
  expect(result.current.hasNext).toBe(false)
  act(() => result.current.previous())
  await waitFor(() => expect(result.current.data?.items).toEqual(['产品甲first']))
  act(() => result.current.next())
  rerender({ filter: '产品乙' })
  await waitFor(() => expect(result.current.data?.items).toEqual(['产品乙first']))
  expect(result.current.page).toBe(1)
  expect(load).not.toHaveBeenCalledWith('产品乙', 'second')
})

it('下一页失败后可以返回，刷新中的旧页不允许重复推进', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  })
  let reject!: (error: Error) => void
  const load = vi.fn((cursor?: string): Promise<CollectionPage<string>> =>
    cursor
      ? new Promise((_, fail) => {
          reject = fail
        })
      : Promise.resolve({ items: ['first'], total: 50, nextCursor: 'second' }),
  )
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  const { result } = renderHook(
    () => useCollectionPage({ queryKey: ['error-page'], queryFn: load }),
    { wrapper: Wrapper },
  )
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  act(() => result.current.next())
  await waitFor(() => expect(result.current.isFetching).toBe(true))
  act(() => result.current.next())
  expect(result.current.page).toBe(2)
  act(() => reject(new Error('offline')))
  await waitFor(() => expect(result.current.isError).toBe(true))
  act(() => result.current.previous())
  await waitFor(() => expect(result.current.data?.items).toEqual(['first']))
  expect(result.current.page).toBe(1)
})
