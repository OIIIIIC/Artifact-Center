import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import {
  enforceRateLimit,
  FixedWindowRateLimiter,
  resolveClientIp,
} from '../middleware/rate-limit.js'

describe('进程内限流', () => {
  it('允许正常突发，在达到窗口阈值后返回 429 和 Retry-After', async () => {
    let now = 1_000
    const limiter = new FixedWindowRateLimiter({
      maxRequests: 2,
      windowMs: 10_000,
      now: () => now,
    })
    const app = new Hono()
    app.get(
      '/login',
      (c) => enforceRateLimit(c, limiter, 'login:10.0.0.1:tester') ?? c.text('ok'),
    )

    expect((await app.request('/login')).status).toBe(200)
    expect((await app.request('/login')).status).toBe(200)
    const limited = await app.request('/login')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('10')
    await expect(limited.json()).resolves.toMatchObject({
      error: { code: 'rate_limited' },
    })

    now += 10_000
    expect((await app.request('/login')).status).toBe(200)
  })

  it('可信代理只使用 Nginx 覆盖的 X-Real-IP，忽略伪造的 X-Forwarded-For', async () => {
    const app = new Hono()
    app.get('/source', (c) => c.text(resolveClientIp(c, true)))

    const response = await app.request('/source', {
      headers: {
        'X-Real-IP': '10.10.0.8',
        'X-Forwarded-For': '198.51.100.10, 203.0.113.9',
      },
    })

    await expect(response.text()).resolves.toBe('10.10.0.8')
  })

  it('未启用可信代理时忽略客户端伪造的转发头', async () => {
    const app = new Hono()
    app.get('/source', (c) => c.text(resolveClientIp(c, false)))

    const response = await app.request('/source', {
      headers: {
        'X-Real-IP': '10.10.0.8',
        'X-Forwarded-For': '198.51.100.10',
      },
    })

    await expect(response.text()).resolves.toBe('unknown')
  })
})
