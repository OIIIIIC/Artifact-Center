import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Tabs } from '@/components/ui/tabs'
import { DetailTabContent } from './detail-tab-content'
import { ApplicationHistoryPage } from './application-history-page'
import type { Application } from '@/types/application'
const page = vi.hoisted(() => vi.fn())
vi.mock('@/services/api', () => ({ apiArtifactPage: page, apiReleasePage: page }))
vi.mock('./artifacts-table', () => ({
  ArtifactsTable: ({ artifacts }: { artifacts: { version: string }[] }) => (
    <div>{artifacts.map((a) => a.version).join(',')}</div>
  ),
}))
vi.mock('./release-notes-panel', () => ({
  ReleaseNotesPanel: ({ releases }: { releases: { version: string }[] }) => (
    <div>{releases.map((a) => a.version).join(',')}</div>
  ),
}))
afterEach(() => vi.restoreAllMocks())
it.each(['artifacts', 'releases'] as const)(
  'refreshes stale %s, preserves filters and reuses fresh data',
  async (kind) => {
    page.mockClear()
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    page.mockResolvedValue({ items: [{ version: 'v1' }], total: 1, nextCursor: null })
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
      },
    })
    const app = { id: 'review-tab-app', name: 'App', status: 'active' } as Application
    const view = (active: string) => (
      <QueryClientProvider client={client}>
        <Tabs value={active}>
          <DetailTabContent active={active === 'artifacts'} value="artifacts">
            <ApplicationHistoryPage
              active={active === 'artifacts'}
              application={app}
              canManage={false}
              kind={kind}
            />
          </DetailTabContent>
          <DetailTabContent active={active === 'overview'} value="overview">
            Overview
          </DetailTabContent>
        </Tabs>
      </QueryClientProvider>
    )
    const { rerender, unmount } = render(view('artifacts'))
    await screen.findByText('v1')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'v' } })
    await waitFor(() => expect(page).toHaveBeenCalledTimes(2))
    rerender(view('overview'))
    rerender(view('artifacts'))
    expect(page).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('textbox')).toHaveValue('v')
    rerender(view('overview'))
    clock.mockReturnValue(now + 60_000)
    page.mockResolvedValue({
      items: [{ version: 'v2' }, { version: 'v1' }],
      total: 2,
      nextCursor: null,
    })
    rerender(view('artifacts'))
    await waitFor(() => expect(page).toHaveBeenCalledTimes(3))
    await screen.findByText('v2,v1')
    expect(screen.getByRole('textbox')).toHaveValue('v')
    unmount()
    client.clear()
  },
)
