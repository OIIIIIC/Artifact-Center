import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const database = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
}))

vi.mock('../db/client.js', () => ({
  db: { select: database.select, update: database.update },
}))
vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', {
      sub: 'user-1',
      name: '管理员',
      email: 'admin@example.com',
      role: 'admin',
      tokenVersion: 1,
    })
    await next()
  },
}))
vi.mock('../lib/jwt.js', () => ({ signAccessToken: vi.fn(async () => 'fresh-token') }))
vi.mock('../lib/audit.js', () => ({ writeAudit: vi.fn() }))

import { authRoutes } from '../routes/auth.js'

const user = {
  id: 'user-1',
  username: 'admin',
  email: 'admin@example.com',
  name: '管理员',
  passwordHash: 'password-hash',
  tokenVersion: 1,
  isActive: true,
  role: 'admin' as const,
  avatarUrl: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function selectRows(rows: unknown[]) {
  const query = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
  query.from.mockReturnValue(query)
  query.where.mockReturnValue(query)
  query.limit.mockResolvedValue(rows)
  database.select.mockReturnValue(query)
}

function updateReturning(row: unknown) {
  const query = { set: database.set, where: vi.fn(), returning: database.returning }
  database.update.mockReturnValue(query)
  database.set.mockReturnValue(query)
  query.where.mockReturnValue(query)
  database.returning.mockResolvedValue([row])
}

describe('个人头像上传', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('接受浏览器生成的小尺寸 data URL', async () => {
    const avatarUrl = `data:image/png;base64,${'A'.repeat(1024)}`
    selectRows([user])
    updateReturning({ ...user, avatarUrl })

    const app = new Hono()
    app.route('/auth', authRoutes)
    const response = await app.request('/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl }),
    })

    expect(response.status).toBe(200)
  })

  it('接受前端允许的 2 MiB 图片转换得到的 data URL', async () => {
    const rawBytes = 2 * 1024 * 1024
    const base64Length = 4 * Math.ceil(rawBytes / 3)
    const avatarUrl = `data:image/png;base64,${'A'.repeat(base64Length)}`
    selectRows([user])
    updateReturning({ ...user, avatarUrl })

    const app = new Hono()
    app.route('/auth', authRoutes)
    const response = await app.request('/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl }),
    })

    expect(response.status).toBe(200)
    expect(database.set).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl }))
  })
})
