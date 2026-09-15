import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const releaseCredentialUser = {
  sub: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
  name: 'Release bot actor',
  email: 'release-bot@example.com',
  role: 'viewer',
  tokenVersion: 1,
}

const access = vi.hoisted(() => ({
  hasApplicationRole: vi.fn(),
}))

const row = {
  application: {
    id: 'f40fcd70-3db9-4f2d-b0dc-bfe47f4f1c15',
    name: 'Mobile Banking',
    applicationCode: 'mobile-banking',
    packageName: 'com.example.banking',
    platform: 'android',
    status: 'active',
  },
  region: {
    id: '4e44c2d2-96ed-4c48-8228-d2121e887c2c',
    code: 'cn',
    name: 'China',
  },
}

const chain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}
chain.from.mockReturnValue(chain)
chain.innerJoin.mockReturnValue(chain)
chain.where.mockReturnValue(chain)
chain.orderBy.mockReturnValue(chain)

vi.mock('../db/client.js', () => ({
  db: { select: vi.fn(() => chain) },
}))

vi.mock('../middleware/upload-auth.js', () => ({
  requireUploadAuth: async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', releaseCredentialUser)
    c.set('uploadCredential', {
      kind: 'release-credential',
      id: 'credential-1',
      name: 'Bino workstation',
    })
    await next()
  },
}))

vi.mock('../middleware/application-access.js', () => ({
  hasApplicationRole: access.hasApplicationRole,
  requireApplicationRole: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

import { releaseApplicationQuerySchema, uploadRoutes } from './uploads.js'

describe('发布目标发现', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chain.from.mockReturnValue(chain)
    chain.innerJoin.mockReturnValue(chain)
    chain.where.mockReturnValue(chain)
    chain.orderBy.mockReturnValue(chain)
    access.hasApplicationRole.mockResolvedValue(true)
  })

  it('只返回可上传目标的必要信息', async () => {
    chain.limit.mockResolvedValue([row])
    const app = new Hono()
    app.route('/', uploadRoutes)

    const response = await app.request('/release/applications?q=banking&platform=android')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: row.application.id,
          name: 'Mobile Banking',
          applicationCode: 'mobile-banking',
          packageName: 'com.example.banking',
          platform: 'android',
          status: 'active',
          accessRole: 'maintainer',
          region: { id: row.region.id, code: 'cn', name: 'China' },
        },
      ],
      total: 1,
    })
    expect(chain.innerJoin).toHaveBeenCalledTimes(2)
  })

  it('按仓库、分支和代码子目录精确匹配，并保留多目标供选择', async () => {
    const binding = {
      repository: 'git@git.example:team/app.git',
      branch: 'main',
      directory: 'apps/care',
    }
    chain.limit.mockResolvedValue([
      { ...row, application: { ...row.application, repositoryBindings: [binding] } },
      {
        ...row,
        application: { ...row.application, id: 'second', repositoryBindings: [binding] },
      },
      {
        ...row,
        application: {
          ...row.application,
          id: 'wrong',
          repositoryBindings: [{ ...binding, branch: 'other' }],
        },
      },
    ])
    const app = new Hono()
    app.route('/', uploadRoutes)
    const params = new URLSearchParams({
      repository: 'https://git.example/team/app',
      branch: 'main',
      directory: 'apps/care',
    })
    const response = await app.request(`/release/applications?${params}`)
    expect(response.status).toBe(200)
    const result = (await response.json()) as { items: Array<{ id: string }> }
    expect(result.items.map((item: { id: string }) => item.id)).toEqual([
      row.application.id,
      'second',
    ])
    expect(chain.innerJoin).toHaveBeenCalledTimes(2)
  })

  it('仓库匹配缺少分支或目录时拒绝请求', async () => {
    const app = new Hono()
    app.route('/', uploadRoutes)
    const response = await app.request(
      '/release/applications?repository=https://git.example/team/app',
    )
    expect(response.status).toBe(400)
    expect(chain.from).not.toHaveBeenCalled()
  })

  it('拒绝不支持的平台筛选条件', () => {
    expect(releaseApplicationQuerySchema.safeParse({ platform: 'ios' }).success).toBe(
      false,
    )
  })

  it('精确目标预检要求发布权限而不只是查看权限', async () => {
    access.hasApplicationRole.mockResolvedValue(false)
    const app = new Hono()
    app.route('/', uploadRoutes)

    const response = await app.request(
      `/release/applications/${row.application.id}/target`,
    )

    expect(response.status).toBe(403)
    expect(access.hasApplicationRole).toHaveBeenCalledWith(
      releaseCredentialUser,
      row.application.id,
      'maintainer',
    )
  })
})
