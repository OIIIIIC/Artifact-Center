import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const database = vi.hoisted(() => ({
  select: vi.fn(),
  innerJoin: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('../db/client.js', () => ({
  db: { select: database.select },
}))

vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (
    context: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    context.set('user', {
      sub: 'user-1',
      role: 'viewer',
      name: '测试用户',
      email: 'viewer@example.com',
    })
    await next()
  },
}))

vi.mock('../middleware/application-access.js', () => ({
  hasApplicationRole: vi.fn(),
}))

import { auditRoutes } from '../routes/audit.js'

const auditRow = {
  id: 'audit-1',
  actorId: 'actor-1',
  actorName: '上传者',
  action: 'artifact.upload',
  objectType: 'artifact',
  objectId: 'artifact-1',
  applicationId: 'app-allowed',
  summary: '上传制品',
  meta: null,
  ip: '127.0.0.1',
  createdAt: new Date('2026-07-30T00:00:00.000Z'),
}

describe('全局审计流权限', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const auditChain = {
      from: vi.fn(),
      innerJoin: database.innerJoin,
      orderBy: vi.fn(),
      offset: vi.fn(),
      limit: database.limit,
    }
    Object.values(auditChain).forEach((method) => method.mockReturnValue(auditChain))
    database.limit.mockResolvedValue([{ audit: auditRow }])

    const applicationChain = {
      from: vi.fn(),
      where: vi.fn(),
    }
    applicationChain.from.mockReturnValue(applicationChain)
    applicationChain.where.mockResolvedValue([
      { id: 'app-allowed', name: '允许访问的应用' },
    ])
    database.select.mockImplementation((fields?: { audit?: unknown }) =>
      fields?.audit ? auditChain : applicationChain,
    )
  })

  it('非管理员通过应用成员关系查询审计记录', async () => {
    const app = new Hono()
    app.route('/audit', auditRoutes)

    const response = await app.request('/audit')
    const body = (await response.json()) as {
      items: Array<{ id: string; applicationId: string }>
    }

    expect(response.status).toBe(200)
    expect(database.innerJoin).toHaveBeenCalledOnce()
    expect(body.items).toEqual([
      expect.objectContaining({
        id: 'audit-1',
        applicationId: 'app-allowed',
        applicationName: '允许访问的应用',
      }),
    ])
  })
})
