import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const database = vi.hoisted(() => ({
  select: vi.fn(),
}))

vi.mock('../db/client.js', () => ({
  db: { select: database.select },
}))

import {
  signAccessToken,
  signDownloadTicket,
  verifyAccessToken,
  verifyDownloadTicket,
} from '../lib/jwt.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'

const claims = {
  sub: 'user-1',
  email: 'user@example.com',
  name: '测试用户',
  role: 'maintainer',
  tokenVersion: 3,
}

function setCurrentUser(row: Record<string, unknown> | undefined) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  }
  query.from.mockReturnValue(query)
  query.where.mockReturnValue(query)
  query.limit.mockResolvedValue(row ? [row] : [])
  database.select.mockReturnValue(query)
}

function protectedApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', requireAuth)
  app.get('/protected', (c) => c.json({ role: c.get('user').role }))
  return app
}

describe('JWT 令牌版本撤销', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('访问令牌和下载票据均携带并解析 tokenVersion', async () => {
    const token = await signAccessToken(claims)
    const ticket = await signDownloadTicket({ ...claims, artifactId: 'artifact-1' })

    await expect(verifyAccessToken(token)).resolves.toMatchObject({
      sub: claims.sub,
      tokenVersion: 3,
    })
    await expect(verifyDownloadTicket(ticket)).resolves.toMatchObject({
      artifactId: 'artifact-1',
      tokenVersion: 3,
    })
  })

  it('当前账户令牌版本变化后拒绝旧令牌', async () => {
    setCurrentUser({
      id: claims.sub,
      role: 'maintainer',
      tokenVersion: 4,
      isActive: true,
    })
    const token = await signAccessToken(claims)

    const response = await protectedApp().request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'unauthorized' },
    })
  })

  it('停用账户后拒绝仍在有效期内的令牌', async () => {
    setCurrentUser({
      id: claims.sub,
      role: 'maintainer',
      tokenVersion: 3,
      isActive: false,
    })
    const token = await signAccessToken(claims)

    const response = await protectedApp().request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(401)
  })

  it('使用数据库中的当前角色，避免 JWT claim 滞后继续授权', async () => {
    setCurrentUser({ id: claims.sub, role: 'viewer', tokenVersion: 3, isActive: true })
    const token = await signAccessToken(claims)

    const response = await protectedApp().request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ role: 'viewer' })
  })
})
