import { describe, expect, it, vi } from 'vitest'

import { createHealthRoutes } from '../routes/health.js'

describe('GET /health', () => {
  const now = new Date('2026-07-30T00:00:00.000Z')

  it('returns 200 OK with expected shape', async () => {
    const app = createHealthRoutes({
      checkDatabase: vi.fn(),
      checkStorage: vi.fn(),
      now: () => now,
      storagePath: '/data/artifacts',
    })
    const res = await app.request('/health')
    expect(res.status).toBe(200)

    const body = (await res.json()) as { time: string }
    expect(body).toHaveProperty('ok', true)
    expect(body).toHaveProperty('service', 'artifact-center-api')
    expect(body).toHaveProperty('time')
  })

  it('returns valid ISO-8601 timestamp', async () => {
    const app = createHealthRoutes({
      checkDatabase: vi.fn(),
      checkStorage: vi.fn(),
      now: () => now,
      storagePath: '/data/artifacts',
    })
    const res = await app.request('/health')
    const body = (await res.json()) as { time: string }
    const parsed = Date.parse(body.time)
    expect(Number.isNaN(parsed)).toBe(false)
  })

  it('returns JSON content-type', async () => {
    const app = createHealthRoutes({
      checkDatabase: vi.fn(),
      checkStorage: vi.fn(),
      now: () => now,
      storagePath: '/data/artifacts',
    })
    const res = await app.request('/health')
    const contentType = res.headers.get('content-type')
    expect(contentType).toContain('application/json')
  })

  it('returns ok: true', async () => {
    const app = createHealthRoutes({
      checkDatabase: vi.fn(),
      checkStorage: vi.fn(),
      now: () => now,
      storagePath: '/data/artifacts',
    })
    const res = await app.request('/health')
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('数据库和存储可用时返回 ready', async () => {
    const app = createHealthRoutes({
      checkDatabase: vi.fn().mockResolvedValue(undefined),
      checkStorage: vi.fn().mockResolvedValue(undefined),
      now: () => now,
      storagePath: '/data/artifacts',
    })

    const response = await app.request('/health/ready')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      checks: { database: 'ok', storage: 'ok' },
    })
  })

  it.each([
    ['database', true, false],
    ['storage', false, true],
  ])('%s 不可用时返回 503', async (_name, databaseFails, storageFails) => {
    const app = createHealthRoutes({
      checkDatabase: databaseFails
        ? vi.fn().mockRejectedValue(new Error('database unavailable'))
        : vi.fn().mockResolvedValue(undefined),
      checkStorage: storageFails
        ? vi.fn().mockRejectedValue(new Error('storage unavailable'))
        : vi.fn().mockResolvedValue(undefined),
      now: () => now,
      storagePath: '/data/artifacts',
    })

    const response = await app.request('/health/ready')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ ok: false })
  })
})
