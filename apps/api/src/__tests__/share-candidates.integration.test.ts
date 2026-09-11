import type { PGlite } from '@electric-sql/pglite'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

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

const app = new Hono().route('/applications', applicationRoutes)
const adminId = '00000000-0000-4000-8000-000000000001'
const memberId = '00000000-0000-4000-8000-000000000002'
const productId = '00000000-0000-4000-8000-000000000010'
const otherProductId = '00000000-0000-4000-8000-000000000011'
const projectId = '00000000-0000-4000-8000-000000000020'
const siblingId = '00000000-0000-4000-8000-000000000021'
let adminToken: string
let memberToken: string

beforeAll(async () => {
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as { entries: { tag: string }[] }
  for (const entry of journal.entries) {
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  }
  await fixture.client.exec(`
    INSERT INTO users (id, username, email, name, password_hash, role) VALUES
      ('${adminId}', 'share-admin', 'admin@share.test', 'Admin', 'test', 'admin'),
      ('${memberId}', 'share-member', 'member@share.test', 'Member', 'test', 'viewer');
    INSERT INTO regions (id, code, name) VALUES
      ('${productId}', 'share', '智慧业务平台'), ('${otherProductId}', 'other', '其他产品');
    INSERT INTO projects (id, product_id, name) VALUES
      ('${projectId}', '${productId}', '河南项目'), ('${siblingId}', '${productId}', '孝感项目');
    INSERT INTO applications (name, application_code, package_name, platform, region_id, project_id, artifact_count)
    SELECT '河南 ' || lpad(n::text, 2, '0'), 'share-' || n, 'com.share.app' || n,
      'android', '${productId}', '${projectId}', 1 FROM generate_series(1, 25) n;
    INSERT INTO applications (name, application_code, package_name, platform, region_id, project_id, artifact_count, status) VALUES
      ('孝感医护屏', 'sibling', 'com.share.sibling', 'android', '${productId}', '${siblingId}', 1, 'active'),
      ('空应用', 'empty', 'com.share.empty', 'android', '${productId}', '${projectId}', 0, 'active'),
      ('已归档', 'archived', 'com.share.archived', 'android', '${productId}', '${projectId}', 1, 'archived');
    INSERT INTO applications (name, application_code, package_name, platform, region_id, artifact_count)
      VALUES ('其他产品应用', 'other', 'com.share.other', 'android', '${otherProductId}', 1);
    INSERT INTO application_members (application_id, user_id, role)
      SELECT id, '${memberId}', CASE WHEN application_code = 'share-2' THEN 'viewer'::application_member_role ELSE 'maintainer'::application_member_role END
      FROM applications WHERE application_code IN ('share-1', 'share-2', 'empty', 'archived', 'sibling');
  `)
  adminToken = await signAccessToken({
    sub: adminId,
    name: 'Admin',
    email: 'admin@share.test',
    role: 'admin',
    tokenVersion: 0,
  })
  memberToken = await signAccessToken({
    sub: memberId,
    name: 'Member',
    email: 'member@share.test',
    role: 'viewer',
    tokenVersion: 0,
  })
}, 30_000)

afterAll(async () => {
  await fixture.client.close()
})

type Page = {
  items: {
    id: string
    projectId: string
    applicationCode: string
    artifactCount: number
    status: string
  }[]
  total: number
  nextCursor: string | null
}
async function getPage(params: string, token = adminToken) {
  const response = await app.request(`/applications?limit=20&${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Page
}

it('当前项目只返回本项目可分享应用，分页前排除空应用和归档应用', async () => {
  const params = `product=${productId}&project=${projectId}&shareable=1`
  const first = await getPage(params)
  expect(first.total).toBe(25)
  expect(first.items).toHaveLength(20)
  expect(first.nextCursor).toBeTruthy()
  const second = await getPage(`${params}&cursor=${first.nextCursor}`)
  expect(second.items).toHaveLength(5)
  expect(second.nextCursor).toBeNull()
  const candidates = [...first.items, ...second.items]
  expect(new Set(candidates.map((item) => item.id)).size).toBe(25)
  expect(
    candidates.every(
      (item) =>
        item.projectId === projectId &&
        item.artifactCount > 0 &&
        item.status !== 'archived',
    ),
  ).toBe(true)
})

it('产品级候选保留该产品所有项目，不能混入其他产品', async () => {
  const params = `product=${productId}&shareable=1`
  const first = await getPage(params)
  const second = await getPage(`${params}&cursor=${first.nextCursor}`)
  expect(first.total).toBe(26)
  const codes = [...first.items, ...second.items].map((item) => item.applicationCode)
  expect(codes).toContain('sibling')
  expect(codes).not.toContain('other')
})

it('分享候选按应用维护权限筛选，计数和分页不包含只读或无权限应用', async () => {
  const project = await getPage(
    `product=${productId}&project=${projectId}&shareable=1`,
    memberToken,
  )
  expect(project.total).toBe(1)
  expect(project.items.map((item) => item.applicationCode)).toEqual(['share-1'])
  const product = await getPage(`product=${productId}&shareable=1`, memberToken)
  expect(product.total).toBe(2)
  expect(product.items.map((item) => item.applicationCode).sort()).toEqual([
    'share-1',
    'sibling',
  ])
})

it('普通应用列表保持原有可见范围，分享游标不可跨项目或切回普通列表', async () => {
  const normal = await getPage(`product=${productId}&project=${projectId}`, memberToken)
  expect(normal.total).toBe(4)
  const first = await getPage(`product=${productId}&project=${projectId}&shareable=1`)
  for (const params of [
    `product=${productId}&project=${siblingId}&shareable=1`,
    `product=${productId}&project=${projectId}`,
  ]) {
    const response = await app.request(
      `/applications?limit=20&${params}&cursor=${first.nextCursor}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    )
    expect(response.status).toBe(400)
  }
})

it('不属于当前产品的项目返回空候选，不回退到产品列表', async () => {
  const page = await getPage(`product=${otherProductId}&project=${projectId}&shareable=1`)
  expect(page).toMatchObject({ items: [], total: 0, nextCursor: null })
})
