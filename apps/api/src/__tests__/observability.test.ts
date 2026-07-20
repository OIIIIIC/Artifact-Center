import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import {
  createRequestObservability,
  logUnhandledError,
  type ObservabilityLog,
} from '../middleware/observability.js'

function createTestApp(
  logs: ObservabilityLog[],
  options: { now?: () => number; createRequestId?: () => string } = {},
) {
  const app = new Hono()
  app.use(
    '*',
    createRequestObservability({
      slowRequestMs: 500,
      write: (log) => logs.push(log),
      ...options,
    }),
  )
  app.get('/items', (c) => c.json({ ok: true }, 201))
  return app
}

describe('请求可观测中间件', () => {
  it('为请求生成可回传、可检索的请求 ID', async () => {
    const logs: ObservabilityLog[] = []
    const app = createTestApp(logs, {
      createRequestId: () => 'generated-request-id',
      now: (() => {
        const values = [100, 125]
        return () => values.shift() ?? 125
      })(),
    })

    const response = await app.request('/items?token=secret')

    expect(response.headers.get('x-request-id')).toBe('generated-request-id')
    expect(logs).toEqual([
      expect.objectContaining({
        event: 'http_request',
        level: 'info',
        requestId: 'generated-request-id',
        method: 'GET',
        path: '/items',
        status: 201,
        durationMs: 25,
      }),
    ])
  })

  it('沿用格式安全的上游请求 ID', async () => {
    const logs: ObservabilityLog[] = []
    const app = createTestApp(logs)

    const response = await app.request('/items', {
      headers: { 'x-request-id': 'proxy-01:abc_123' },
    })

    expect(response.headers.get('x-request-id')).toBe('proxy-01:abc_123')
    expect(logs[0]?.requestId).toBe('proxy-01:abc_123')
  })

  it('遮蔽公开分享路径中的访问令牌', async () => {
    const logs: ObservabilityLog[] = []
    const app = new Hono()
    app.use(
      '*',
      createRequestObservability({
        slowRequestMs: 500,
        write: (log) => logs.push(log),
      }),
    )
    app.get('/public/shares/:token/items/:itemId/download', (c) => c.body('ok'))

    await app.request('/public/shares/secret-share-token/items/item-1/download')

    expect(logs[0]?.path).toBe('/public/shares/:token/items/item-1/download')
  })

  it('拒绝可能污染日志的上游请求 ID', async () => {
    const logs: ObservabilityLog[] = []
    const app = createTestApp(logs, {
      createRequestId: () => 'safe-request-id',
    })

    const response = await app.request('/items', {
      headers: { 'x-request-id': 'bad request id' },
    })

    expect(response.headers.get('x-request-id')).toBe('safe-request-id')
    expect(logs[0]?.requestId).toBe('safe-request-id')
  })

  it('超过阈值时标记为慢请求', async () => {
    const logs: ObservabilityLog[] = []
    const app = createTestApp(logs, {
      now: (() => {
        const values = [1_000, 1_750]
        return () => values.shift() ?? 1_750
      })(),
    })

    await app.request('/items')

    expect(logs[0]).toEqual(
      expect.objectContaining({
        level: 'warn',
        slow: true,
        durationMs: 750,
        slowRequestMs: 500,
      }),
    )
  })

  it('异常响应仍返回同一个请求 ID 并记录 500', async () => {
    const logs: ObservabilityLog[] = []
    const app = new Hono()
    app.use(
      '*',
      createRequestObservability({
        slowRequestMs: 500,
        createRequestId: () => 'failed-request-id',
        write: (log) => logs.push(log),
      }),
    )
    app.get('/broken', () => {
      throw new Error('boom')
    })
    app.onError((_error, c) => c.json({ error: 'internal' }, 500))

    const response = await app.request('/broken')

    expect(response.status).toBe(500)
    expect(response.headers.get('x-request-id')).toBe('failed-request-id')
    expect(logs[0]).toEqual(
      expect.objectContaining({
        requestId: 'failed-request-id',
        status: 500,
        level: 'error',
      }),
    )
  })

  it('异常详情使用同一个请求 ID', async () => {
    const writeError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const app = new Hono()
    app.use(
      '*',
      createRequestObservability({
        slowRequestMs: 500,
        createRequestId: () => 'error-detail-request-id',
        write: () => undefined,
      }),
    )
    app.get('/broken', () => {
      throw new Error('boom')
    })
    app.onError((error, c) => {
      logUnhandledError(c, error)
      return c.json({ error: 'internal' }, 500)
    })

    await app.request('/broken')

    const errorLog = JSON.parse(String(writeError.mock.calls[0]?.[0])) as ObservabilityLog
    expect(errorLog).toEqual(
      expect.objectContaining({
        event: 'unhandled_error',
        level: 'error',
        requestId: 'error-detail-request-id',
        path: '/broken',
      }),
    )
    writeError.mockRestore()
  })
})
