import { describe, expect, it, vi } from 'vitest'

import { resolveShareToken } from './resolve-share'

const apiResolveShare = vi.fn()

vi.mock('@/services/api', () => ({
  apiResolveShare: (...args: unknown[]) => apiResolveShare(...args),
}))

describe('resolveShareToken', () => {
  it('uses the capability token from the URL for anonymous downloads', async () => {
    apiResolveShare.mockResolvedValue({
      ok: true,
      share: {
        id: 'share-1',
        kind: 'single',
        title: 'Mobile Banking',
        regionId: 'region-1',
        createdBy: '张盈睿',
        expiresAt: null,
        createdAt: '2026-08-15T00:00:00.000Z',
        downloadCount: 0,
      },
      region: null,
      items: [],
    })

    const result = await resolveShareToken('capability-token')

    expect(result).toMatchObject({
      ok: true,
      serverToken: 'capability-token',
    })
  })
})
