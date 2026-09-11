import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useApplications } from '@/features/applications/use-applications'
import { queryKeys } from '@/lib/query-keys'
import { apiDirectorySummary } from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import { QueryProvider } from './query-provider'

const user = (id: string) => ({
  id,
  username: id,
  name: id,
  email: `${id}@example.com`,
  role: 'maintainer' as const,
  avatarUrl: null,
})
const page = (id: string) => ({
  items: [
    {
      id: `app-${id}`,
      name: `${id} 的应用`,
      platform: 'android',
      region: { id: 'region' },
      latestVersion: `${id}.0`,
      artifactCount: id === 'A' ? 12 : 3,
    },
  ],
  total: id === 'A' ? 8 : 2,
  nextCursor: null,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
let captureClient: (client: QueryClient) => void
function Catalog() {
  const catalog = useApplications()
  const summary = useQuery({
    queryKey: queryKeys.applications.summary,
    queryFn: ({ signal }) => apiDirectorySummary(signal),
  })
  return (
    <div data-testid="catalog">
      {JSON.stringify({
        total: catalog.total,
        summary: summary.data?.total,
        apps: catalog.applications,
      })}
    </div>
  )
}
function Session() {
  const current = useAuthStore((s) => s.user)
  const client = useQueryClient()
  useEffect(() => captureClient(client), [client, current?.id])
  return (
    <>
      <input aria-label="草稿" defaultValue="未保存" />
      {current ? <Catalog /> : null}
    </>
  )
}
async function login(id: string) {
  await act(async () => {
    await useAuthStore.getState().login({ identifier: id, password: 'test-only' })
  })
}
function mount() {
  return render(
    <StrictMode>
      <QueryProvider>
        <MemoryRouter>
          <Session />
        </MemoryRouter>
      </QueryProvider>
    </StrictMode>,
  )
}
let listResponse: (id: string, signal?: AbortSignal | null) => Promise<Response>
beforeEach(() => {
  captureClient = () => {}
  useAuthStore.getState().logout()
  listResponse = async (id) => Response.json(page(id))
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input)
    if (path.endsWith('/auth/login')) {
      const id = JSON.parse(String(init?.body)).identifier
      return Response.json({ token: `token-${id}`, user: user(id) })
    }
    const id = new Headers(init?.headers).get('Authorization')?.slice(-1) ?? ''
    if (path.includes('/applications/summary'))
      return Response.json({ total: id === 'A' ? 8 : 2 })
    if (path.includes('/applications?')) return listResponse(id, init?.signal)
    throw new Error(`Unexpected request: ${path}`)
  })
})
afterEach(() => {
  cleanup()
  useAuthStore.getState().logout()
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('账号之间的查询隔离', () => {
  it('新账号加载期间不显示旧账号应用，随后显示新数量与版本', async () => {
    mount()
    await login('A')
    await waitFor(() =>
      expect(screen.getByTestId('catalog')).toHaveTextContent('A 的应用'),
    )
    const next = deferred<Response>()
    listResponse = (id) =>
      id === 'B'
        ? next.promise.then((response) => response.clone())
        : Promise.resolve(Response.json(page(id)))
    act(() => useAuthStore.getState().logout())
    await login('B')
    expect(screen.getByTestId('catalog')).not.toHaveTextContent('A 的应用')
    await act(async () => {
      next.resolve(Response.json(page('B')))
    })
    await waitFor(() =>
      expect(screen.getByTestId('catalog')).toHaveTextContent('B 的应用'),
    )
    expect(screen.getByTestId('catalog')).toHaveTextContent('"total":2,"summary":2')
    expect(screen.getByTestId('catalog')).toHaveTextContent('"latestVersion":"B.0"')
    expect(screen.getByTestId('catalog')).toHaveTextContent('"artifactCount":3')
  })

  it('退出时取消旧查询，忽略晚到响应并丢弃旧缓存', async () => {
    const old = deferred<Response>()
    let oldSignal: AbortSignal | null | undefined
    listResponse = (id, signal) => {
      if (id === 'A') {
        oldSignal = signal
        return old.promise
      }
      return Promise.resolve(Response.json(page(id)))
    }
    let oldClient!: QueryClient
    captureClient = (client) => {
      if (useAuthStore.getState().user?.id === 'A') oldClient = client
    }
    mount()
    await login('A')
    await waitFor(() => expect(oldSignal).toBeDefined())
    act(() => useAuthStore.getState().logout())
    expect(oldSignal?.aborted).toBe(true)
    await login('B')
    await waitFor(() =>
      expect(screen.getByTestId('catalog')).toHaveTextContent('B 的应用'),
    )
    await act(async () => {
      old.resolve(Response.json(page('A')))
    })
    expect(screen.getByTestId('catalog')).not.toHaveTextContent('A 的应用')
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('同一账号刷新资料和令牌时保留缓存与未保存输入', async () => {
    mount()
    await login('A')
    await waitFor(() =>
      expect(screen.getByTestId('catalog')).toHaveTextContent('A 的应用'),
    )
    const draft = screen.getByLabelText('草稿')
    const requests = vi.mocked(fetch).mock.calls.length
    act(() =>
      useAuthStore.setState({
        user: { ...user('A'), name: '新名字' },
        token: 'rotated-token',
      }),
    )
    expect(screen.getByLabelText('草稿')).toBe(draft)
    expect(screen.getByTestId('catalog')).toHaveTextContent('A 的应用')
    expect(vi.mocked(fetch).mock.calls).toHaveLength(requests)
  })
})
