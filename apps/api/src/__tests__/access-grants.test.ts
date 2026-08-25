import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ role: 'admin' as 'admin' | 'viewer' }))
const database = vi.hoisted(() => ({ select: vi.fn(), transaction: vi.fn() }))

vi.mock('../db/client.js', () => ({
  db: { select: database.select, transaction: database.transaction },
}))
vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', {
      sub: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
      name: '管理员',
      email: 'admin@example.com',
      role: session.role,
      tokenVersion: 1,
    })
    await next()
  },
}))
vi.mock('../lib/audit.js', () => ({ writeAudit: vi.fn() }))

import { settingsRoutes } from '../routes/settings.js'

function selectRows(...rowSets: unknown[][]) {
  database.select.mockImplementation(() => {
    const rows = rowSets.shift() ?? []
    const query = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    }
    query.from.mockReturnValue(query)
    query.innerJoin.mockReturnValue(query)
    query.where.mockReturnValue(query)
    query.limit.mockResolvedValue(rows)
    return query
  })
}

describe('批量应用权限接口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.role = 'admin'
  })

  it('管理员一次读取账户的全部应用权限并标记负责人', async () => {
    selectRows([
      {
        applicationId: '98185fe8-e1a4-427d-b1db-6117c70b7f6c',
        role: 'maintainer',
        ownerId: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
      },
      {
        applicationId: 'eb09067b-2be2-451d-8e01-2fa6720a3285',
        role: 'viewer',
        ownerId: 'e1097804-c9dc-468a-993e-17b174089511',
      },
    ])
    const app = new Hono()
    app.route('/settings', settingsRoutes)

    const response = await app.request(
      '/settings/access-grants/4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          applicationId: '98185fe8-e1a4-427d-b1db-6117c70b7f6c',
          role: 'maintainer',
          isOwner: true,
        },
        {
          applicationId: 'eb09067b-2be2-451d-8e01-2fa6720a3285',
          role: 'viewer',
          isOwner: false,
        },
      ],
    })
  })

  it('非管理员无法读取或修改批量权限', async () => {
    session.role = 'viewer'
    const app = new Hono()
    app.route('/settings', settingsRoutes)

    const response = await app.request(
      '/settings/access-grants/4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
    )

    expect(response.status).toBe(403)
    expect(database.select).not.toHaveBeenCalled()
  })

  it('允许为平台查看者授予应用维护者', async () => {
    selectRows(
      [
        {
          id: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
          name: '平台查看者',
          role: 'viewer',
        },
      ],
      [
        {
          id: '98185fe8-e1a4-427d-b1db-6117c70b7f6c',
          name: '移动银行',
          ownerId: 'e1097804-c9dc-468a-993e-17b174089511',
        },
      ],
    )
    const upsert = { values: vi.fn(), onConflictDoUpdate: vi.fn() }
    upsert.values.mockReturnValue(upsert)
    upsert.onConflictDoUpdate.mockResolvedValue(undefined)
    database.transaction.mockImplementation(async (callback) =>
      callback({ insert: vi.fn(() => upsert) }),
    )
    const app = new Hono()
    app.route('/settings', settingsRoutes)

    const response = await app.request('/settings/access-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'set',
        userId: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
        applicationIds: ['98185fe8-e1a4-427d-b1db-6117c70b7f6c'],
        role: 'maintainer',
      }),
    })

    expect(response.status).toBe(200)
    expect(upsert.onConflictDoUpdate).toHaveBeenCalledTimes(1)
  })

  it('不允许降级或移除应用负责人', async () => {
    selectRows(
      [
        {
          id: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
          name: '负责人',
          role: 'maintainer',
        },
      ],
      [
        {
          id: '98185fe8-e1a4-427d-b1db-6117c70b7f6c',
          name: '移动银行',
          ownerId: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
        },
      ],
    )
    const app = new Hono()
    app.route('/settings', settingsRoutes)

    const response = await app.request('/settings/access-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'remove',
        userId: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
        applicationIds: ['98185fe8-e1a4-427d-b1db-6117c70b7f6c'],
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'owner_membership_required' },
    })
  })

  it('应用不存在时不会执行部分批量写入', async () => {
    selectRows(
      [
        {
          id: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
          name: '维护者',
          role: 'maintainer',
        },
      ],
      [],
    )
    const app = new Hono()
    app.route('/settings', settingsRoutes)

    const response = await app.request('/settings/access-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'set',
        userId: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
        applicationIds: ['98185fe8-e1a4-427d-b1db-6117c70b7f6c'],
        role: 'viewer',
      }),
    })

    expect(response.status).toBe(400)
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('对有效应用以单个事务完成批量授权', async () => {
    selectRows(
      [
        {
          id: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
          name: '维护者',
          role: 'maintainer',
        },
      ],
      [
        {
          id: '98185fe8-e1a4-427d-b1db-6117c70b7f6c',
          name: '移动银行',
          ownerId: 'e1097804-c9dc-468a-993e-17b174089511',
        },
      ],
    )
    const upsert = { values: vi.fn(), onConflictDoUpdate: vi.fn() }
    upsert.values.mockReturnValue(upsert)
    upsert.onConflictDoUpdate.mockResolvedValue(undefined)
    database.transaction.mockImplementation(async (callback) =>
      callback({ insert: vi.fn(() => upsert) }),
    )
    const app = new Hono()
    app.route('/settings', settingsRoutes)

    const response = await app.request('/settings/access-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'set',
        userId: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
        applicationIds: ['98185fe8-e1a4-427d-b1db-6117c70b7f6c'],
        role: 'viewer',
      }),
    })

    expect(response.status).toBe(200)
    expect(database.transaction).toHaveBeenCalledTimes(1)
    expect(upsert.onConflictDoUpdate).toHaveBeenCalledTimes(1)
  })
})
