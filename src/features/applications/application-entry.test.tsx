import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApplicationEntryPreparation, prepareApplicationEntry } from './application-entry'
import { queryKeys } from '@/lib/query-keys'
import { useApplications } from './use-applications'

const mocks = vi.hoisted(() => ({
  code: vi.fn(() => new Promise(() => {})),
  page: vi.fn(async () => ({ items: [], total: 0, nextCursor: null })),
  products: vi.fn(async () => []),
  projects: vi.fn(async () => []),
  summary: vi.fn(async () => ({ total: 0 })),
  workspace: vi.fn(async () => ({})),
}))
vi.mock('@/routes/load-applications-page', () => ({ loadApplicationsPage: mocks.code }))
vi.mock('@/services/api', () => ({
  apiApplicationPage: mocks.page,
  apiListRegions: mocks.products,
  apiListProjects: mocks.projects,
  apiDirectorySummary: mocks.summary,
  apiGetPersonalWorkspace: mocks.workspace,
}))
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
})
const client = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })

it('starts first-page data while page code is pending and reuses the exact scoped cache', async () => {
  const cache = client()
  await prepareApplicationEntry(cache, '?product=p1&project=j1&platform=android&q=screen')
  expect(mocks.code).toHaveBeenCalled()
  expect(mocks.page).toHaveBeenCalledTimes(1)
  expect(mocks.page).toHaveBeenCalledWith(
    expect.objectContaining({
      product: 'p1',
      project: 'j1',
      platform: 'android',
      q: 'screen',
      limit: 24,
    }),
    expect.any(AbortSignal),
  )
  const scope = {
    q: 'screen',
    platform: 'android',
    sort: 'updated',
    product: 'p1',
    project: 'j1',
    scope: undefined,
    favorites: undefined,
  }
  expect(
    cache.getQueryData(['applications', 'page', scope, { cursor: undefined }]),
  ).toEqual({ items: [], total: 0, nextCursor: null })
  expect(cache.getQueryData(queryKeys.regions.list)).toEqual([])
  const { result } = renderHook(() => useApplications(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cache}>
        <MemoryRouter
          initialEntries={['/?product=p1&project=j1&platform=android&q=screen']}
        >
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    ),
  })
  expect(result.current.loading).toBe(false)
  await prepareApplicationEntry(cache, '?product=p1&project=j1&platform=android&q=screen')
  expect(mocks.page).toHaveBeenCalledTimes(1)
})

it('prepares a direct homepage and root-link navigation but not unrelated or external links', async () => {
  const cache = client()
  render(
    <QueryClientProvider client={cache}>
      <ApplicationEntryPreparation />
      <a href="/?product=p2">Applications</a>
      <a href="/products">Products</a>
      <a href="https://example.com/">External</a>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(mocks.page).toHaveBeenCalledTimes(1))
  fireEvent.focusIn(document.querySelector('a[href="/products"]')!)
  fireEvent.pointerOver(document.querySelector('a[href="https://example.com/"]')!)
  expect(mocks.page).toHaveBeenCalledTimes(1)
  fireEvent.focusIn(document.querySelector('a[href="/?product=p2"]')!)
  await waitFor(() => expect(mocks.page).toHaveBeenCalledTimes(2))
})

it('does not start application data merely by opening a non-application page', () => {
  window.history.replaceState({}, '', '/workspace')
  render(
    <QueryClientProvider client={client()}>
      <ApplicationEntryPreparation />
    </QueryClientProvider>,
  )
  expect(mocks.page).not.toHaveBeenCalled()
  expect(mocks.products).not.toHaveBeenCalled()
})

it('does not repopulate a cleared session with a late prefetch result', async () => {
  let finish!: (data: { items: never[]; total: number; nextCursor: null }) => void
  mocks.page.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const cache = client()
  const request = prepareApplicationEntry(cache, '')
  cache.clear()
  finish({ items: [], total: 0, nextCursor: null })
  await request
  expect(cache.getQueryCache().getAll()).toHaveLength(0)
})
