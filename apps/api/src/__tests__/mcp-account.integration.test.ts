import type { PGlite } from '@electric-sql/pglite'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ client: null as unknown as PGlite }))
vi.mock('../db/client.js', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm')
  fixture.client = new PGlite({ extensions: { pg_trgm } })
  return { db: drizzle(fixture.client) }
})
import { signAccessToken } from '../lib/jwt.js'
import { hashMcpToken } from '../lib/mcp-credential.js'
import { mcpCredentialRoutes } from '../routes/mcp-credentials.js'
import { settingsRoutes } from '../routes/settings.js'
import { userRoutes } from '../routes/users.js'
import { applicationRoutes } from '../routes/applications.js'
import { uploadRoutes } from '../routes/uploads.js'
import { authRoutes } from '../routes/auth.js'

const app = new Hono()
  .route('/account/mcp-credentials', mcpCredentialRoutes)
  .route('/auth', authRoutes)
  .route('/settings', settingsRoutes)
  .route('/users', userRoutes)
  .route('/', uploadRoutes)
  .route('/applications', applicationRoutes)
const admin = '00000000-0000-4000-8000-000000000001'
const viewer = '00000000-0000-4000-8000-000000000002'
const product = '00000000-0000-4000-8000-000000000010'
const application = '00000000-0000-4000-8000-000000000020'
let adminJwt: string
let viewerJwt: string
let adminMcp: string
let viewerMcp: string
const request = (path: string, token: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const create = async (jwt: string) => {
  const response = await request('/account/mcp-credentials', jwt, 'POST', {
    name: 'Test device',
  })
  expect(response.status).toBe(201)
  return response.json() as Promise<{ token: string; credential: { id: string } }>
}
beforeAll(async () => {
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as { entries: { tag: string }[] }
  for (const entry of journal.entries)
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  await fixture.client
    .exec(`INSERT INTO users (id,username,email,name,password_hash,role) VALUES
    ('${admin}','mcp-admin','admin@mcp.test','Admin','unused','admin'),
    ('${viewer}','mcp-viewer','viewer@mcp.test','Viewer','unused','viewer');
    INSERT INTO regions (id,code,name) VALUES ('${product}','mcp','MCP');`)
  const project = (
    await fixture.client.query<{ id: string }>(
      'SELECT id FROM projects WHERE product_id=$1 AND is_default',
      [product],
    )
  ).rows[0].id
  await fixture.client.query(
    `INSERT INTO applications (id,name,application_code,package_name,platform,region_id,project_id)
    VALUES ($1,'MCP App','mcp-app','com.mcp','android',$2,$3)`,
    [application, product, project],
  )
  adminJwt = await signAccessToken({
    sub: admin,
    email: 'admin@mcp.test',
    name: 'Admin',
    role: 'admin',
    tokenVersion: 0,
  })
  viewerJwt = await signAccessToken({
    sub: viewer,
    email: 'viewer@mcp.test',
    name: 'Viewer',
    role: 'viewer',
    tokenVersion: 0,
  })
  adminMcp = (await create(adminJwt)).token
  viewerMcp = (await create(viewerJwt)).token
}, 60_000)
afterAll(async () => {
  await fixture.client.close()
})

describe('账号绑定 MCP 凭据与现有管理接口', () => {
  it('只存摘要，列表不返回摘要或秘密，并记录创建审计', async () => {
    expect(adminMcp).toMatch(/^acmt_/)
    const stored = await fixture.client.query<{ token_hash: string }>(
      'SELECT token_hash FROM mcp_credentials WHERE user_id=$1',
      [admin],
    )
    expect(stored.rows[0].token_hash).toBe(hashMcpToken(adminMcp))
    const response = await request('/account/mcp-credentials', adminMcp)
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).not.toContain('tokenHash')
    expect(body).not.toContain(adminMcp)
    const audit = await fixture.client.query('SELECT * FROM audit_logs WHERE action=$1', [
      'mcp_credential.create',
    ])
    expect(audit.rows.length).toBe(2)
  })
  it('管理员可管理用户与项目，普通账号被现有服务端接口拒绝', async () => {
    expect((await request('/users', adminMcp)).status).toBe(200)
    expect((await request('/users', viewerMcp)).status).toBe(403)
    expect(
      (
        await request('/settings/projects', viewerMcp, 'POST', {
          productId: product,
          name: 'Denied',
        })
      ).status,
    ).toBe(403)
    const response = await request('/settings/projects', adminMcp, 'POST', {
      productId: product,
      name: 'MCP created project',
    })
    expect(response.status).toBe(201)
    const audit = await fixture.client.query<{
      meta: { source: string }
      actor_id: string
    }>('SELECT meta,actor_id FROM audit_logs WHERE action=$1', [
      'settings.project_create',
    ])
    expect(audit.rows[0]).toMatchObject({ actor_id: admin, meta: { source: 'mcp' } })
  })
  it('应用成员权限实时生效，查看者不能获得发布目标', async () => {
    expect((await request(`/applications/${application}`, viewerMcp)).status).toBe(403)
    await fixture.client.query(
      'INSERT INTO application_members (application_id,user_id,role) VALUES ($1,$2,$3)',
      [application, viewer, 'viewer'],
    )
    expect((await request(`/applications/${application}`, viewerMcp)).status).toBe(200)
    const targets = (await (
      await request('/release/applications', viewerMcp)
    ).json()) as { items: { id: string }[] }
    expect(targets.items).toEqual([])
    await fixture.client.query(
      'UPDATE application_members SET role=$1 WHERE user_id=$2',
      ['maintainer', viewer],
    )
    const published = (await (
      await request('/release/applications', viewerMcp)
    ).json()) as { items: { id: string }[] }
    expect(published.items.map((item: { id: string }) => item.id)).toContain(application)
    await fixture.client.query('DELETE FROM application_members WHERE user_id=$1', [
      viewer,
    ])
    expect((await request(`/applications/${application}`, viewerMcp)).status).toBe(403)
  })
  it('MCP 不能创建额外账号凭据或通过更新资料取得浏览器会话', async () => {
    expect(
      (await request('/account/mcp-credentials', adminMcp, 'POST', { name: 'child' }))
        .status,
    ).toBe(403)
    const response = await request('/auth/me', adminMcp, 'PATCH', { name: 'MCP Admin' })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { token?: string }).token).toBeUndefined()
    // The auth middleware accepts whitespace after Bearer; delegation checks must
    // normalize identically rather than matching the untrimmed raw header.
    expect(
      (
        await request('/account/mcp-credentials', `  ${adminMcp}`, 'POST', {
          name: 'child',
        })
      ).status,
    ).toBe(403)
    const spaced = await request('/auth/me', `  ${adminMcp}`, 'PATCH', {
      name: 'MCP Admin',
    })
    expect(spaced.status).toBe(200)
    expect(((await spaced.json()) as { token?: string }).token).toBeUndefined()
  })
  it('凭据按账号隔离，可单独撤销且撤销立即生效', async () => {
    const { token, credential } = await create(adminJwt)
    expect(
      (await request(`/account/mcp-credentials/${credential.id}`, viewerMcp, 'DELETE'))
        .status,
    ).toBe(404)
    expect((await request('/auth/me', token)).status).toBe(200)
    expect(
      (await request(`/account/mcp-credentials/${credential.id}`, adminMcp, 'DELETE'))
        .status,
    ).toBe(200)
    expect((await request('/auth/me', token)).status).toBe(401)
    expect((await request('/auth/me', adminMcp)).status).toBe(200)
  })
  it('过期、伪造和原发布凭据无法访问管理接口', async () => {
    const { token } = await create(adminJwt)
    await fixture.client.query(
      "UPDATE mcp_credentials SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",
      [hashMcpToken(token)],
    )
    for (const value of [token, 'acmt_invalid', 'acrt_original_release_credential'])
      expect((await request('/users', value)).status).toBe(401)
  })
  it('服务端使用当前角色，停用或密码/角色令牌版本变化立即撤销', async () => {
    const { token } = await create(adminJwt)
    await fixture.client.query('UPDATE users SET role=$1 WHERE id=$2', ['viewer', admin])
    expect((await request('/users', token)).status).toBe(403)
    await fixture.client.query('UPDATE users SET role=$1,is_active=false WHERE id=$2', [
      'admin',
      admin,
    ])
    expect((await request('/users', token)).status).toBe(401)
    await fixture.client.query(
      'UPDATE users SET is_active=true,token_version=token_version+1 WHERE id=$1',
      [admin],
    )
    expect((await request('/users', token)).status).toBe(401)
  })
})
