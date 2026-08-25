import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

const viewerUser = {
  sub: '4f5c81c9-6e4f-4faa-a65d-2a53a34ae9d1',
  name: '应用维护者',
  email: 'maintainer@example.com',
  role: 'viewer',
  tokenVersion: 1,
}

vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', viewerUser)
    await next()
  },
  validateCurrentAuthUser: vi.fn(),
}))

vi.mock('../middleware/upload-auth.js', () => ({
  requireUploadAuth: async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', viewerUser)
    c.set('uploadCredential', { kind: 'user' })
    await next()
  },
}))

vi.mock('../middleware/application-access.js', () => ({
  hasApplicationRole: vi.fn(async () => true),
  requireApplicationRole: () => async (_c: unknown, next: () => Promise<void>) => {
    await next()
  },
}))

vi.mock('../lib/audit.js', () => ({ writeAudit: vi.fn() }))

import { shareRoutes } from '../routes/shares.js'
import { uploadRoutes } from '../routes/uploads.js'

describe('应用维护者路由不叠加平台角色门槛', () => {
  it('平台 viewer 通过应用维护者校验后可进入上传参数校验', async () => {
    const app = new Hono()
    app.route('/', uploadRoutes)

    const response = await app.request('/applications/app-1/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_body' },
    })
  })

  it('平台 viewer 通过应用维护者校验后可进入分享参数校验', async () => {
    const app = new Hono()
    app.route('/', shareRoutes)

    const response = await app.request('/applications/app-1/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInDays: 999 }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_body' },
    })
  })
})
