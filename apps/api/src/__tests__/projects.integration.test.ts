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
import { applicationRoutes } from '../routes/applications.js'
import { settingsRoutes } from '../routes/settings.js'
import { workspaceRoutes } from '../routes/workspace.js'

const app = new Hono()
  .route('/settings', settingsRoutes)
  .route('/applications', applicationRoutes)
  .route('/workspace', workspaceRoutes)
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  viewer: '00000000-0000-4000-8000-000000000002',
  product: '00000000-0000-4000-8000-000000000010',
  other: '00000000-0000-4000-8000-000000000011',
  legacy: '00000000-0000-4000-8000-000000000020',
}
let adminToken: string
let viewerToken: string
let defaultProject: string
let beforeMigration: Record<string, unknown>
type ResponseBody = {
  region: { id: string }
  project: { id: string }
  application: { projectId: string }
  items: { id: string }[]
  error: { code: string }
  preferences: { projectId: string | null }
}
type JsonResponse = Omit<Response, 'json'> & { json(): Promise<ResponseBody> }
const request = (path: string, method = 'GET', body?: unknown, token = adminToken) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }) as Promise<JsonResponse>

beforeAll(async () => {
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as { entries: { idx: number; tag: string }[] }
  for (const entry of journal.entries) {
    if (entry.idx === 22) {
      await fixture.client
        .exec(`INSERT INTO regions (id,code,name) VALUES ('${ids.product}','kaifeng','开封'),('${ids.other}','sansha','三沙');
        INSERT INTO applications (id,name,application_code,package_name,platform,region_id) VALUES ('${ids.legacy}','旧应用','legacy','com.example.legacy','android','${ids.product}');`)
      beforeMigration = (
        await fixture.client.query<Record<string, unknown>>(
          'SELECT * FROM applications WHERE id=$1',
          [ids.legacy],
        )
      ).rows[0]
    }
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  }
  await fixture.client
    .exec(`INSERT INTO users (id,username,email,name,password_hash,role) VALUES
    ('${ids.admin}','project-admin','admin@projects.test','Admin','test','admin'),
    ('${ids.viewer}','project-viewer','viewer@projects.test','Viewer','test','viewer');`)
  adminToken = await signAccessToken({
    sub: ids.admin,
    name: 'Admin',
    email: 'admin@projects.test',
    role: 'admin',
    tokenVersion: 0,
  })
  viewerToken = await signAccessToken({
    sub: ids.viewer,
    name: 'Viewer',
    email: 'viewer@projects.test',
    role: 'viewer',
    tokenVersion: 0,
  })
  defaultProject = (
    await fixture.client.query<{ id: string }>(
      'SELECT id FROM projects WHERE product_id=$1 AND is_default',
      [ids.product],
    )
  ).rows[0].id
}, 30_000)

afterAll(async () => {
  await fixture.client.close()
})

describe('产品 → 项目 → 应用（真实 SQL 迁移与 API）', () => {
  it('一次保存完整项目顺序，拒绝过期、重复、遗漏与跨产品的顺序', async () => {
    const { region } = await (
      await request('/settings/regions', 'POST', { name: '排序产品', code: 'ordering' })
    ).json()
    for (const [name, sortOrder] of [
      ['一期', 1],
      ['二期', 2],
    ] as const)
      await request('/settings/projects', 'POST', {
        productId: region.id,
        name,
        sortOrder,
      })
    const readOrder = async () =>
      (
        await (await request(`/settings/projects?productId=${region.id}`)).json()
      ).items.map((p) => p.id)
    const before = await readOrder()
    const next = [...before].reverse()
    const payload = { productId: region.id, projectIds: next, expectedOrder: before }
    expect(
      (await request('/settings/projects/order', 'PUT', payload, viewerToken)).status,
    ).toBe(403)
    expect((await request('/settings/projects/order', 'PUT', payload)).status).toBe(200)
    expect(await readOrder()).toEqual(next)
    expect(
      (
        await fixture.client.query<{ sort_order: number }>(
          'SELECT sort_order FROM projects WHERE product_id=$1 ORDER BY sort_order',
          [region.id],
        )
      ).rows.map((p) => p.sort_order),
    ).toEqual([0, 1, 2])
    // 相同长度也必须校验原顺序，不能覆盖另一位管理员刚完成的排序。
    expect((await request('/settings/projects/order', 'PUT', payload)).status).toBe(409)
    expect(
      (
        await request('/settings/projects/order', 'PUT', {
          ...payload,
          expectedOrder: next,
          projectIds: [next[0], next[0], next[2]],
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await request('/settings/projects/order', 'PUT', {
          ...payload,
          expectedOrder: next,
          projectIds: next.slice(1),
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await request('/settings/projects/order', 'PUT', {
          ...payload,
          expectedOrder: next,
          projectIds: [defaultProject, ...next.slice(1)],
        })
      ).status,
    ).toBe(409)
    expect(await readOrder()).toEqual(next)
    // 另一次维护新增了项目时，也不会因拖动旧列表而丢失它的排序。
    await request('/settings/projects', 'POST', {
      productId: region.id,
      name: '新项目',
      sortOrder: 3,
    })
    expect(
      (
        await request('/settings/projects/order', 'PUT', {
          ...payload,
          expectedOrder: next,
        })
      ).status,
    ).toBe(409)
    expect(await readOrder()).toHaveLength(4)
  })

  it('重命名不会重置项目顺序或停用状态', async () => {
    const { project } = await (
      await request('/settings/projects', 'POST', {
        productId: ids.product,
        name: '待更名项目',
        sortOrder: 17,
        enabled: false,
      })
    ).json()
    expect(
      (await request('/settings/projects/' + project.id, 'PATCH', { name: '更名后项目' }))
        .status,
    ).toBe(200)
    expect(
      (
        await fixture.client.query(
          'SELECT name,sort_order,enabled FROM projects WHERE id=$1',
          [project.id],
        )
      ).rows,
    ).toEqual([{ name: '更名后项目', sort_order: 17, enabled: false }])
    await request('/settings/projects/' + project.id, 'DELETE')
  })

  it('保留旧产品和应用的全部字段，只补上默认项目归属', async () => {
    const row = (
      await fixture.client.query<Record<string, unknown>>(
        'SELECT * FROM applications WHERE id=$1',
        [ids.legacy],
      )
    ).rows[0]
    expect(row.project_id).toBe(defaultProject)
    const original = { ...row }
    delete original.project_id
    expect(original).toEqual(beforeMigration)
    expect(
      (await fixture.client.query('SELECT name FROM regions WHERE id=$1', [ids.product]))
        .rows,
    ).toEqual([{ name: '开封' }])
  })

  it('新产品自动有默认项目，旧客户端创建应用也有项目归属', async () => {
    const productResponse = await request('/settings/regions', 'POST', {
      name: '十堰',
      code: 'shiyan',
    })
    expect(productResponse.status).toBe(201)
    const { region } = await productResponse.json()
    const response = await request('/applications', 'POST', {
      name: '兼容应用',
      applicationCode: 'compatible',
      description: '旧客户端',
      packageName: 'com.example.compatible',
      platform: 'android',
      regionId: region.id,
    })
    expect(response.status).toBe(201)
    const { application } = await response.json()
    const projects = await (
      await request(`/settings/projects?productId=${region.id}`)
    ).json()
    expect(projects.items).toHaveLength(1)
    expect(application.projectId).toBe(projects.items[0].id)
  })

  it('拒绝跨产品绑定；API 与数据库外键均保护归属', async () => {
    const response = await request('/applications/' + ids.legacy, 'PATCH', {
      regionId: ids.other,
      projectId: defaultProject,
    })
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('project_unavailable')
    await expect(
      fixture.client.query(
        'INSERT INTO applications (name,application_code,package_name,platform,region_id,project_id) VALUES ($1,$2,$3,$4,$5,$6)',
        ['Invalid', 'invalid', 'com.invalid', 'android', ids.other, defaultProject],
      ),
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('项目管理限制管理员，目录元数据不会赋予应用访问权限', async () => {
    expect(
      (
        await request(
          '/settings/projects',
          'POST',
          { productId: ids.product, name: '不应创建' },
          viewerToken,
        )
      ).status,
    ).toBe(403)
    expect(
      (await request('/settings/projects', 'GET', undefined, viewerToken)).status,
    ).toBe(200)
    const list = await (
      await request('/applications', 'GET', undefined, viewerToken)
    ).json()
    expect(list.items).toEqual([])
    expect(
      (await request('/applications/' + ids.legacy, 'GET', undefined, viewerToken))
        .status,
    ).toBe(403)
  })

  it('同产品项目名唯一；停用项目保留原归属并禁止新绑定', async () => {
    const create = await request('/settings/projects', 'POST', {
      productId: ids.product,
      name: '一期交付',
    })
    expect(create.status).toBe(201)
    const { project } = await create.json()
    expect(
      (
        await request('/settings/projects', 'POST', {
          productId: ids.product,
          name: '一期交付',
        })
      ).status,
    ).toBe(409)
    expect(
      (await request('/applications/' + ids.legacy, 'PATCH', { projectId: project.id }))
        .status,
    ).toBe(200)
    expect((await request('/settings/projects/' + project.id, 'DELETE')).status).toBe(409)
    expect(
      (await request('/settings/projects/' + project.id, 'PATCH', { enabled: false }))
        .status,
    ).toBe(200)
    expect(
      (
        await request('/applications/' + ids.legacy, 'PATCH', {
          description: '仍可编辑已有应用',
          regionId: ids.product,
          projectId: project.id,
        })
      ).status,
    ).toBe(200)
    const denied = await request('/applications', 'POST', {
      name: '新绑定',
      applicationCode: 'new',
      description: '测试',
      packageName: 'com.example.new',
      platform: 'android',
      regionId: ids.product,
      projectId: project.id,
    })
    expect(denied.status).toBe(400)
    expect(
      (
        await request('/applications/' + ids.legacy, 'PATCH', {
          projectId: defaultProject,
        })
      ).status,
    ).toBe(200)
    expect((await request('/settings/projects/' + project.id, 'DELETE')).status).toBe(200)
  })

  it('默认项目不可删除或停用；产品切换清除旧项目偏好', async () => {
    expect((await request('/settings/projects/' + defaultProject, 'DELETE')).status).toBe(
      409,
    )
    expect(
      (await request('/settings/projects/' + defaultProject, 'PATCH', { enabled: false }))
        .status,
    ).toBe(409)
    expect(
      (
        await request('/workspace/preferences', 'PUT', {
          regionId: ids.product,
          projectId: defaultProject,
        })
      ).status,
    ).toBe(200)
    const restored = await (await request('/workspace')).json()
    expect(restored.preferences.projectId).toBe(defaultProject)
    const switched = await (
      await request('/workspace/preferences', 'PUT', { regionId: ids.other })
    ).json()
    expect(switched.preferences.projectId).toBeNull()
    expect(
      (
        await request('/workspace/preferences', 'PUT', {
          regionId: ids.other,
          projectId: defaultProject,
        })
      ).status,
    ).toBe(400)
  })
})
