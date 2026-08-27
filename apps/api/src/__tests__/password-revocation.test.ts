import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const database = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('../db/client.js', () => ({
  db: {
    select: database.select,
    update: database.update,
    execute: database.execute,
    transaction: database.transaction,
  },
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
vi.mock('../middleware/require-admin.js', () => ({
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
}))
vi.mock('../lib/password.js', () => ({
  hashPassword: vi.fn(async () => 'new-password-hash'),
  verifyPassword: vi.fn(async () => true),
}))
vi.mock('../lib/jwt.js', () => ({ signAccessToken: vi.fn(async () => 'fresh-token') }))
vi.mock('../lib/audit.js', () => ({ writeAudit: vi.fn() }))

import { authRoutes } from '../routes/auth.js'
import { userRoutes } from '../routes/users.js'

const user = {
  id: 'user-1',
  username: 'admin',
  email: 'admin@example.com',
  name: '管理员',
  passwordHash: 'old-password-hash',
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

function updateReturning(row?: unknown) {
  const query = { set: database.set, where: vi.fn(), returning: database.returning }
  database.update.mockReturnValue(query)
  database.set.mockReturnValue(query)
  query.where.mockReturnValue(query)
  database.returning.mockResolvedValue(row ? [row] : [])
}

describe('密码变更撤销旧令牌', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.transaction.mockImplementation(async (callback) =>
      callback({
        select: database.select,
        update: database.update,
        execute: database.execute,
      }),
    )
  })

  it('用户改密码时递增 tokenVersion 并返回新令牌', async () => {
    selectRows([user])
    updateReturning({ ...user, tokenVersion: 2, passwordHash: 'new-password-hash' })
    const app = new Hono()
    app.route('/auth', authRoutes)

    const response = await app.request('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'OldPassword9!',
        newPassword: 'NewPassword9!',
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, token: 'fresh-token' })
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: 'new-password-hash',
        tokenVersion: expect.anything(),
      }),
    )
  })

  it('管理员停用账号时递增目标用户 tokenVersion', async () => {
    selectRows([{ ...user, id: 'user-2', role: 'maintainer' }])
    updateReturning({
      ...user,
      id: 'user-2',
      role: 'maintainer',
      isActive: false,
      tokenVersion: 2,
    })
    const app = new Hono()
    app.route('/users', userRoutes)

    const response = await app.request('/users/user-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })

    expect(response.status).toBe(200)
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false, tokenVersion: expect.anything() }),
    )
  })

  it('管理员不能直接把自己降级，必须使用移交流程', async () => {
    selectRows([user])
    const app = new Hono()
    app.route('/users', userRoutes)

    const response = await app.request('/users/user-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({ code: 'self_role_change_requires_transfer' }),
    })
    expect(database.update).not.toHaveBeenCalled()
  })

  it('移交在同一事务内提升接收人并降级当前管理员', async () => {
    const recipient = {
      ...user,
      id: '950b71a7-6100-4bfe-9b90-5e0c7defec02',
      name: '接收成员',
      role: 'viewer' as const,
    }
    const selectQueue = [[user], [recipient]]
    database.select.mockImplementation(() => {
      const query = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
      query.from.mockReturnValue(query)
      query.where.mockReturnValue(query)
      query.limit.mockResolvedValue(selectQueue.shift() ?? [])
      return query
    })
    const returningRows = [
      { ...recipient, role: 'admin' as const, tokenVersion: 2 },
      { ...user, role: 'viewer' as const, tokenVersion: 2 },
    ]
    updateReturning()
    database.returning.mockImplementation(async () => [returningRows.shift()])
    const app = new Hono()
    app.route('/users', userRoutes)

    const response = await app.request('/users/me/transfer-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId: recipient.id,
        nextRole: 'viewer',
      }),
    })

    expect(response.status).toBe(200)
    expect(database.execute).toHaveBeenCalledOnce()
    expect(database.set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ role: 'admin', tokenVersion: expect.anything() }),
    )
    expect(database.set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ role: 'viewer', tokenVersion: expect.anything() }),
    )
  })

  it('管理员重置密码时递增目标用户 tokenVersion', async () => {
    selectRows([{ id: user.id, name: user.name, email: user.email }])
    updateReturning()
    const app = new Hono()
    app.route('/users', userRoutes)

    const response = await app.request(`/users/${user.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NewPassword9!' }),
    })

    expect(response.status).toBe(200)
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: 'new-password-hash',
        tokenVersion: expect.anything(),
      }),
    )
  })
})
