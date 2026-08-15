import { describe, expect, it, vi } from 'vitest'

const { returning, where, set, update } = vi.hoisted(() => {
  const returning = vi.fn()
  const where = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where }))
  const update = vi.fn(() => ({ set }))
  return { returning, where, set, update }
})

vi.mock('../db/client.js', () => ({
  db: { update },
}))

import { revokeExpiredShares } from './share-expiration.js'

describe('revokeExpiredShares', () => {
  it('revokes every active share that has reached its expiry time', async () => {
    const now = new Date('2026-08-15T12:00:00.000Z')
    returning.mockResolvedValue([{ id: 'share-1' }, { id: 'share-2' }])

    await expect(revokeExpiredShares(now)).resolves.toEqual({ revoked: 2 })
    expect(update).toHaveBeenCalledOnce()
    expect(set).toHaveBeenCalledWith({ revokedAt: now })
    expect(where).toHaveBeenCalledOnce()
  })
})
