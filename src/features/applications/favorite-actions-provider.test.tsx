import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { FavoriteActionsProvider } from './favorite-actions-provider'
import { useFavoriteActions } from './use-favorite-actions'
import { queryKeys } from '@/lib/query-keys'
import { apiSetApplicationFavorite, type PersonalWorkspace } from '@/services/api'
import { toast } from 'sonner'

vi.mock('@/services/api', () => ({ apiSetApplicationFavorite: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
beforeEach(() => {
  vi.mocked(apiSetApplicationFavorite).mockReset()
})

function Actions() {
  const { toggleFavorite } = useFavoriteActions()
  return (
    <>
      {['a', 'b', 'c'].map((id) => (
        <button key={id} onClick={() => toggleFavorite(id, id)}>
          {id}
        </button>
      ))}
    </>
  )
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(queryKeys.personalWorkspace, {
    favoriteApplicationIds: ['a', 'b', 'c'],
    recentApplications: [],
    preferences: {},
  })
  const view = render(
    <QueryClientProvider client={client}>
      <FavoriteActionsProvider>
        <Actions />
      </FavoriteActionsProvider>
    </QueryClientProvider>,
  )
  const ids = () =>
    client.getQueryData<PersonalWorkspace>(queryKeys.personalWorkspace)
      ?.favoriteApplicationIds
  return { ...view, client, ids }
}

it('undo restores a middle favorite in place and requests persisted order restoration', async () => {
  vi.mocked(apiSetApplicationFavorite).mockResolvedValue(true)
  const { ids } = mount()
  fireEvent.click(screen.getByRole('button', { name: 'b' }))
  await waitFor(() => expect(ids()).toEqual(['a', 'c']))
  fireEvent.click(
    await screen.findByRole('button', { name: 'applications.workspace.undo' }),
  )
  await waitFor(() => expect(ids()).toEqual(['a', 'b', 'c']))
  expect(apiSetApplicationFavorite).toHaveBeenLastCalledWith('b', true, true)
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
})

it('rolls back only the failed application during concurrent removals', async () => {
  let rejectFirst!: (error: Error) => void
  vi.mocked(apiSetApplicationFavorite).mockImplementation((id) =>
    id === 'a'
      ? new Promise((_resolve, reject) => {
          rejectFirst = reject
        })
      : Promise.resolve(false),
  )
  const { ids } = mount()
  fireEvent.click(screen.getByRole('button', { name: 'a' }))
  fireEvent.click(screen.getByRole('button', { name: 'b' }))
  await waitFor(() => expect(ids()).toEqual(['c']))
  await act(async () => rejectFirst(new Error('offline')))
  await waitFor(() => expect(ids()).toEqual(['a', 'c']))
  expect(toast.error).toHaveBeenCalled()
  expect(screen.getAllByRole('status')).toHaveLength(1)
})

it('does not recreate undo prompts after the session unmounts', async () => {
  let complete!: (value: boolean) => void
  vi.mocked(apiSetApplicationFavorite).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  const { unmount } = mount()
  fireEvent.click(screen.getByRole('button', { name: 'b' }))
  await waitFor(() => expect(apiSetApplicationFavorite).toHaveBeenCalled())
  unmount()
  await act(async () => complete(false))
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
})
