import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const database = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  orderBy: vi.fn(),
}))

const auth = vi.hoisted(() => ({
  role: 'admin' as 'admin' | 'viewer',
}))

vi.mock('../db/client.js', () => ({
  db: {
    select: database.select,
    insert: database.insert,
  },
}))

vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', {
      sub: 'admin-1',
      name: 'Release Admin',
      email: 'admin@example.com',
      role: auth.role,
      tokenVersion: 1,
    })
    await next()
  },
}))

vi.mock('../lib/audit.js', () => ({ writeAudit: vi.fn() }))

import { hashReleaseCredentialToken } from '../lib/release-credential.js'
import { releaseCredentialRoutes } from '../routes/release-credentials.js'

const credential = {
  id: 'credential-1',
  actorUserId: 'admin-1',
  name: 'Codex MCP',
  tokenHash: 'stored-only-as-a-digest',
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-08-19T00:00:00.000Z'),
}

function createApp() {
  const app = new Hono()
  app.route('/settings/release-credentials', releaseCredentialRoutes)
  return app
}

describe('平台发布机器人凭据', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.role = 'admin'
  })

  it('管理员创建 MCP 凭据时只返回一次明文，并且数据库只接收摘要', async () => {
    const insertQuery = { values: database.values, returning: database.returning }
    database.insert.mockReturnValue(insertQuery)
    database.values.mockReturnValue(insertQuery)
    database.returning.mockResolvedValue([credential])

    const response = await createApp().request('/settings/release-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Codex MCP' }),
    })

    expect(response.status).toBe(201)
    const body = (await response.json()) as { token: string }
    expect(body.token).toMatch(/^acrt_/)
    expect(database.values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        name: 'Codex MCP',
        tokenHash: hashReleaseCredentialToken(body.token),
      }),
    )
  })

  it('列出凭据时永不回显可重放令牌', async () => {
    const query = { from: vi.fn(), orderBy: database.orderBy }
    database.select.mockReturnValue(query)
    query.from.mockReturnValue(query)
    database.orderBy.mockResolvedValue([credential])

    const response = await createApp().request('/settings/release-credentials')

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      items: [expect.objectContaining({ id: 'credential-1', name: 'Codex MCP' })],
    })
    expect(body).not.toHaveProperty('items.0.token')
  })

  it('非管理员不能创建机器凭据', async () => {
    auth.role = 'viewer'

    const response = await createApp().request('/settings/release-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'not-allowed' }),
    })

    expect(response.status).toBe(403)
    expect(database.insert).not.toHaveBeenCalled()
  })
})
