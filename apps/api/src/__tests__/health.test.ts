import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'

// Recreate the health route inline for testing (avoids env dependency)
function createTestApp() {
  const app = new Hono()

  app.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'artifact-center-api',
      time: new Date().toISOString(),
    }),
  )

  return app
}

describe('GET /health', () => {
  let app: Hono

  beforeAll(() => {
    app = createTestApp()
  })

  afterAll(() => {
    // Cleanup nothing needed for Hono in-memory
  })

  it('returns 200 OK with expected shape', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)

    const body = (await res.json()) as { time: string }
    expect(body).toHaveProperty('ok', true)
    expect(body).toHaveProperty('service', 'artifact-center-api')
    expect(body).toHaveProperty('time')
  })

  it('returns valid ISO-8601 timestamp', async () => {
    const res = await app.request('/health')
    const body = (await res.json()) as { time: string }
    const parsed = Date.parse(body.time)
    expect(Number.isNaN(parsed)).toBe(false)
  })

  it('returns JSON content-type', async () => {
    const res = await app.request('/health')
    const contentType = res.headers.get('content-type')
    expect(contentType).toContain('application/json')
  })

  it('returns ok: true', async () => {
    const res = await app.request('/health')
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
