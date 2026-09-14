import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import '@/i18n'
import { apiCreateRegion } from '@/services/api'
import { ProductEditor } from './product-editor'

vi.mock('@/services/api', () => ({
  apiCreateRegion: vi.fn(),
  apiUpdateRegion: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it('在 HTTP 内网缺少 randomUUID 时仍能创建产品', async () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
  vi.stubGlobal('crypto', { getRandomValues })
  const saved = vi.fn()
  vi.mocked(apiCreateRegion).mockResolvedValue({ id: 'new-product' } as Awaited<
    ReturnType<typeof apiCreateRegion>
  >)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProductEditor
        draft={{ name: '内网产品', code: '', sortOrder: '0' }}
        onChange={vi.fn()}
        onCancel={vi.fn()}
        onSaved={saved}
      />
    </QueryClientProvider>,
  )
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(apiCreateRegion).toHaveBeenCalledOnce())
  const [body] = vi.mocked(apiCreateRegion).mock.calls[0]
  expect(body).toEqual({
    name: '内网产品',
    code: expect.stringMatching(/^product-[a-z0-9-]+$/),
    sortOrder: 0,
  })
  expect(body.code.length).toBeLessThanOrEqual(64)
  await waitFor(() => expect(saved).toHaveBeenCalledOnce())
})
