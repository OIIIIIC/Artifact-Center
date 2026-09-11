import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import '@/i18n'
import { ActivityPanel } from '@/features/applications/activity-panel'
import { queryKeys } from '@/lib/query-keys'
import type { Application, Product } from '@/types/application'
import { ShareCollectionAction } from './share-collection-action'
import { ShareDialog } from './share-dialog'
import { ShareLinksPanel } from './share-links-panel'

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  create: vi.fn(),
  createSingle: vi.fn(),
  revoke: vi.fn(),
  list: vi.fn(),
  page: vi.fn(),
  copy: vi.fn(),
}))
vi.mock('@/services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/api')>()),
  apiListAudit: mocks.audit,
  apiCreateShareCollection: mocks.create,
  apiCreateShare: mocks.createSingle,
  apiRevokeShare: mocks.revoke,
  apiListShares: mocks.list,
  apiApplicationPage: mocks.page,
}))
vi.mock('@/lib/clipboard', () => ({ copyText: mocks.copy }))

const product = { id: 'product', name: '测试产品' } as Product
const applications = [1, 2].map((n) => ({
  id: `app-${n}`,
  name: `应用 ${n}`,
  region: product,
  latestVersion: '1.0.0',
  artifactCount: 1,
  status: 'active',
})) as Application[]
let eventSummary: string | null
let revoked: boolean
const share = {
  id: 'share-1',
  token: 'activity-token',
  kind: 'collection',
  title: '测试清单',
  applicationId: 'app-1',
  itemCount: 2,
  createdBy: '测试用户',
  createdAt: new Date().toISOString(),
  expiresAt: null,
  mode: 'latest',
}

beforeEach(() => {
  vi.clearAllMocks()
  eventSummary = null
  revoked = false
  mocks.copy.mockResolvedValue(true)
  mocks.audit.mockImplementation(async ({ applicationId }) => ({
    items: eventSummary
      ? [
          {
            id: 'audit-share',
            applicationId,
            action: revoked ? 'share.revoke' : 'share.create',
            summary: eventSummary,
            actorName: '测试用户',
            createdAt: new Date().toISOString(),
          },
        ]
      : [],
    nextOffset: null,
  }))
  mocks.create.mockImplementation(async () => {
    eventSummary = '创建分享清单 · 测试清单'
    return share
  })
  mocks.createSingle.mockImplementation(async () => {
    eventSummary = '创建分享链接 · 应用 1'
    return share
  })
  mocks.revoke.mockImplementation(async () => {
    eventSummary = '吊销分享链接'
    revoked = true
    return share
  })
  mocks.list.mockImplementation(async () => (revoked ? [] : [share]))
  mocks.page.mockResolvedValue({ items: applications, total: 2, nextCursor: null })
})
afterEach(cleanup)

function harness(action: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  })
  client.setQueryData(queryKeys.audit.global, {
    pages: [{ items: [], nextOffset: null }],
    pageParams: [0],
  })
  const view = (children: ReactNode) => (
    <QueryClientProvider client={client}>
      {children}
      <section aria-label="首项活动">
        <ActivityPanel applicationId="app-1" />
      </section>
      <section aria-label="次项活动">
        <ActivityPanel applicationId="app-2" />
      </section>
    </QueryClientProvider>
  )
  return { client, view, ...render(view(action)) }
}
async function openCollection() {
  fireEvent.click(screen.getByRole('button', { name: '分享产品应用' }))
  fireEvent.click(await screen.findByRole('button', { name: '全选' }))
  fireEvent.click(screen.getByRole('button', { name: '生成并复制清单链接' }))
}

it('创建清单后，已缓存的首项、次项活动均刷新，全局日志缓存失效', async () => {
  const { client } = harness(<ShareCollectionAction product={product} />)
  await waitFor(() => expect(mocks.audit).toHaveBeenCalledTimes(2))
  await openCollection()
  for (const name of ['首项活动', '次项活动']) {
    expect(
      await within(screen.getByRole('region', { name })).findByText(
        '创建分享清单 · 测试清单',
      ),
    ).toBeInTheDocument()
  }
  expect(client.getQueryState(queryKeys.audit.global)?.isInvalidated).toBe(true)
  await waitFor(() => expect(mocks.copy).toHaveBeenCalledOnce())
})

it('活动刷新尚未完成时也会立即复制已生成的链接', async () => {
  harness(<ShareCollectionAction product={product} />)
  await waitFor(() => expect(mocks.audit).toHaveBeenCalledTimes(2))
  mocks.audit.mockImplementation(() => new Promise(() => {}))
  await openCollection()
  await waitFor(() =>
    expect(mocks.copy).toHaveBeenCalledWith(expect.stringContaining('/d/activity-token')),
  )
  expect(await screen.findByRole('button', { name: '再次复制' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '生成并复制清单链接' })).toBeEnabled()
})

it('创建单应用分享同样更新活动；复制已有链接不产生新活动', async () => {
  harness(
    <ShareDialog
      open
      onOpenChange={() => {}}
      applicationId="app-1"
      applicationName="应用 1"
    />,
  )
  await waitFor(() => expect(mocks.audit).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: '生成并复制链接' }))
  expect(
    await within(screen.getByRole('region', { name: '首项活动' })).findByText(
      '创建分享链接 · 应用 1',
    ),
  ).toBeInTheDocument()
  await waitFor(() => expect(mocks.copy).toHaveBeenCalledOnce())
  const requests = mocks.audit.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: '再次复制' }))
  await waitFor(() => expect(mocks.copy).toHaveBeenCalledTimes(2))
  expect(mocks.createSingle).toHaveBeenCalledOnce()
  expect(mocks.audit).toHaveBeenCalledTimes(requests)
})

it('从首项吊销清单后，次项活动与其缓存中的分享列表也同步更新', async () => {
  const { client } = harness(<ShareLinksPanel applicationId="app-1" />)
  client.setQueryData(['shares', 'app-2'], [share])
  await waitFor(() => expect(mocks.audit).toHaveBeenCalledTimes(2))
  fireEvent.click(await screen.findByRole('button', { name: '吊销' }))
  for (const name of ['首项活动', '次项活动']) {
    expect(
      await within(screen.getByRole('region', { name })).findByText('吊销分享链接'),
    ).toBeInTheDocument()
  }
  expect(client.getQueryState(['shares', 'app-2'])?.isInvalidated).toBe(true)
  expect(client.getQueryState(queryKeys.audit.global)?.isInvalidated).toBe(true)
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '吊销' })).not.toBeInTheDocument(),
  )
})
