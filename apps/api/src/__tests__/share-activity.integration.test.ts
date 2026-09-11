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
import { auditRoutes } from '../routes/audit.js'
import { shareRoutes } from '../routes/shares.js'

const app = new Hono().route('/audit', auditRoutes).route('/', shareRoutes)
const adminId = '00000000-0000-4000-8000-000000000001'
const memberId = '00000000-0000-4000-8000-000000000002'
const productId = '00000000-0000-4000-8000-000000000010'
const appIds = [20, 21, 22].map((id) => `00000000-0000-4000-8000-0000000000${id}`)
let adminToken: string, memberToken: string

beforeAll(async () => {
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as { entries: { tag: string }[] }
  for (const entry of journal.entries)
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  await fixture.client.exec(`
    INSERT INTO users (id, username, email, name, password_hash, role) VALUES
      ('${adminId}', 'activity-admin', 'admin@activity.test', 'Admin', 'test', 'admin'),
      ('${memberId}', 'activity-viewer', 'viewer@activity.test', 'Viewer', 'test', 'viewer');
    INSERT INTO regions (id, code, name) VALUES ('${productId}', 'activity', '测试产品');
    INSERT INTO applications (id, name, application_code, package_name, platform, region_id, artifact_count) VALUES
      ('${appIds[0]}', '首项应用', 'first', 'com.activity.first', 'android', '${productId}', 1),
      ('${appIds[1]}', '十堰医护屏', 'second', 'com.activity.second', 'android', '${productId}', 1),
      ('${appIds[2]}', '未分享的应用', 'unrelated', 'com.activity.unrelated', 'android', '${productId}', 1);
    INSERT INTO application_members (application_id, user_id, role) VALUES ('${appIds[1]}', '${memberId}', 'viewer');
  `)
  adminToken = await signAccessToken({
    sub: adminId,
    name: 'Admin',
    email: 'admin@activity.test',
    role: 'admin',
    tokenVersion: 0,
  })
  memberToken = await signAccessToken({
    sub: memberId,
    name: 'Viewer',
    email: 'viewer@activity.test',
    role: 'viewer',
    tokenVersion: 0,
  })
}, 30_000)
afterAll(async () => {
  await fixture.client.close()
})

type AuditItem = {
  id: string
  action: string
  applicationId: string | null
  applicationName: string | null
  objectId: string
  summary: string
  meta: Record<string, unknown>
}
async function activity(applicationId?: string, token = adminToken, extra = '') {
  const response = await app.request(
    `/audit?${applicationId ? `applicationId=${applicationId}&` : ''}${extra}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(response.status).toBe(200)
  return (await response.json()) as { items: AuditItem[]; nextOffset: number | null }
}
async function createCollection() {
  const response = await app.request('/shares', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: '现场安装包',
      regionId: productId,
      items: appIds
        .slice(0, 2)
        .map((applicationId) => ({ applicationId, mode: 'latest' })),
    }),
  })
  expect(response.status).toBe(201)
  return ((await response.json()) as { share: { id: string } }).share.id
}

it('创建清单后每个被选应用都展示同一条活动，全局不会重复记录', async () => {
  const shareId = await createCollection()
  const feeds = await Promise.all(appIds.slice(0, 2).map((id) => activity(id)))
  const events = feeds.map((feed) =>
    feed.items.filter((item) => item.objectId === shareId),
  )
  expect(events.map((items) => items.length)).toEqual([1, 1])
  expect(events[0][0].id).toBe(events[1][0].id)
  expect(events[1][0]).toMatchObject({
    action: 'share.create',
    applicationId: appIds[1],
    applicationName: '十堰医护屏',
  })
  expect(
    (await activity(appIds[2])).items.some((item) => item.objectId === shareId),
  ).toBe(false)
  expect(
    (await activity()).items.filter((item) => item.objectId === shareId),
  ).toHaveLength(1)
})

it('只拥有清单第二项权限的用户可以看到本应用活动，不泄露首项名称或越权读取', async () => {
  const shareId = await createCollection()
  const feed = await activity(appIds[1], memberToken)
  expect(feed.items.find((item) => item.objectId === shareId)).toMatchObject({
    applicationId: appIds[1],
    applicationName: '十堰医护屏',
  })
  expect(JSON.stringify(feed)).not.toContain('首项应用')
  const forbidden = await app.request(`/audit?applicationId=${appIds[0]}`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  })
  expect(forbidden.status).toBe(403)
})

it('旧创建记录凭应用列表快照显示，即使分享或首项已不在；非分享事件不扩散', async () => {
  const meta = JSON.stringify({ kind: 'collection', applicationIds: appIds.slice(0, 2) })
  await fixture.client.query(
    `INSERT INTO audit_logs (action, object_type, object_id, application_id, summary, meta) VALUES
    ('share.create', 'application', 'historical-collection', NULL, '历史分享清单', $1::jsonb),
    ('app.update', 'application', 'unrelated-update', $2, '不属于第二项的更新', $1::jsonb)`,
    [meta, appIds[0]],
  )
  const feed = await activity(appIds[1])
  expect(
    feed.items.filter((item) => item.objectId === 'historical-collection'),
  ).toHaveLength(1)
  expect(feed.items.some((item) => item.objectId === 'unrelated-update')).toBe(false)
})

it('吊销清单也关联全部应用，历史成员快照在分享删除后仍然可读', async () => {
  const shareId = await createCollection()
  const response = await app.request(`/shares/${shareId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  expect(response.status).toBe(200)
  await fixture.client.query('DELETE FROM share_links WHERE id=$1', [shareId])
  for (const applicationId of appIds.slice(0, 2)) {
    const events = (await activity(applicationId)).items.filter(
      (item) => item.objectId === shareId,
    )
    expect(events.map((item) => item.action).sort()).toEqual([
      'share.create',
      'share.revoke',
    ])
  }
})

it('旧吊销记录缺少成员快照时可通过现存分享项关联第二个应用', async () => {
  const shareId = await createCollection()
  await fixture.client.query(
    `INSERT INTO audit_logs (action, object_type, object_id, application_id, summary, meta)
    VALUES ('share.revoke', 'application', $1, $2, '历史吊销分享', '{"kind":"collection"}'::jsonb)`,
    [shareId, appIds[0]],
  )
  expect(
    (await activity(appIds[1])).items.some(
      (item) => item.summary === '历史吊销分享' && item.objectId === shareId,
    ),
  ).toBe(true)
})

it('按关联应用过滤后再分页，翻页不会漏掉只在清单快照中的活动', async () => {
  const first = await activity(appIds[1], adminToken, 'limit=1')
  expect(first.items).toHaveLength(1)
  expect(first.nextOffset).toBe(1)
  const second = await activity(appIds[1], adminToken, 'limit=1&offset=1')
  expect(second.items).toHaveLength(1)
  expect(first.items[0].id).not.toBe(second.items[0].id)
})
