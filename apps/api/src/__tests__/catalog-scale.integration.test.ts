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
import { searchRoutes } from '../routes/search.js'

const app = new Hono()
  .route('/applications', applicationRoutes)
  .route('/search', searchRoutes)
const adminId = '00000000-0000-4000-8000-000000000001'
const productId = '00000000-0000-4000-8000-000000000010'
const viewerId = '00000000-0000-4000-8000-000000000002'
let token: string
let viewerToken: string
let historyAppId: string

beforeAll(async () => {
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as {
    entries: { tag: string }[]
  }
  for (const entry of journal.entries) {
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  }
  await fixture.client.exec(`
    INSERT INTO users (id, username, email, name, password_hash, role)
    VALUES ('${adminId}', 'scale-admin', 'admin@scale.test', 'Admin', 'test', 'admin');
    INSERT INTO regions (id, code, name) VALUES ('${productId}', 'scale', '容量验证');
    INSERT INTO applications (name, application_code, package_name, platform, region_id, description)
    SELECT '应用 ' || lpad(n::text, 5, '0'), 'scale-' || n, 'com.scale.app' || n,
           'android', '${productId}', repeat('用于容量验证的应用说明。', 20)
    FROM generate_series(1, 1000) n;
  `)
  historyAppId = (
    await fixture.client.query<{ id: string }>(
      "SELECT id FROM applications WHERE application_code='scale-1'",
    )
  ).rows[0].id
  await fixture.client
    .exec(`INSERT INTO users (id,username,email,name,password_hash,role) VALUES ('${viewerId}','scale-viewer','viewer@scale.test','Viewer','test','viewer');
    INSERT INTO application_members (application_id,user_id,role) VALUES ('${historyAppId}','${viewerId}','viewer');`)
  viewerToken = await signAccessToken({
    sub: viewerId,
    name: 'Viewer',
    email: 'viewer@scale.test',
    role: 'viewer',
    tokenVersion: 0,
  })
  token = await signAccessToken({
    sub: adminId,
    name: 'Admin',
    email: 'admin@scale.test',
    role: 'admin',
    tokenVersion: 0,
  })
  await fixture.client.exec(`
    INSERT INTO releases (application_id, version, release_notes, published_at)
    SELECT '${historyAppId}', '1.0.' || n, repeat('发布说明。', 100), '2026-08-01'::timestamptz + n * interval '1 microsecond' FROM generate_series(1,300) n;
    INSERT INTO artifacts (application_id, release_id, version, platform, type, original_filename, filename, storage_key, release_notes, uploaded_at, status)
    SELECT application_id, id, version, 'android', 'apk', 'test.apk', 'test.apk', 'scale/' || id, release_notes, published_at,
      CASE WHEN version='1.0.1' THEN 'latest'::artifact_status ELSE 'stable'::artifact_status END
    FROM releases WHERE application_id='${historyAppId}';
  `)
}, 30_000)

afterAll(async () => {
  await fixture.client.close()
})

it('应用增长到 1000 个时，首批仅返回请求的 24 个应用', async () => {
  const started = performance.now()
  const response = await app.request('/applications?limit=24&offset=0', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const raw = await response.text()
  const body = JSON.parse(raw) as { items: { id: string }[]; total: number }
  console.info(
    JSON.stringify({
      scenario: '1000 applications / first 24',
      ms: Math.round(performance.now() - started),
      bytes: Buffer.byteLength(raw),
      returned: body.items.length,
    }),
  )
  expect(response.status).toBe(200)
  expect(body.items).toHaveLength(24)
  expect(body.total).toBe(1000)
})

type PageBody = {
  items: { id: string; version: string; artifactCount: number; artifactTypes: string[] }[]
  total: number
  nextCursor: string | null
}
async function getPage(path: string, accessToken = token) {
  const response = await app.request(path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  expect(response.status).toBe(200)
  return (await response.json()) as PageBody
}

it('微秒时间与相同名称翻页无遗漏；游标锚点删除后仍能继续', async () => {
  const seen = new Set<string>()
  let cursor: string | null = null
  do {
    const page: PageBody = await getPage(
      `/applications/${historyAppId}/artifacts?limit=100${cursor ? `&cursor=${cursor}` : ''}`,
    )
    for (const row of page.items) {
      expect(seen.has(row.id)).toBe(false)
      seen.add(row.id)
    }
    cursor = page.nextCursor
  } while (cursor)
  expect(seen.size).toBe(300)
  await fixture.client.exec(
    "UPDATE applications SET name='同名应用' WHERE application_code IN (SELECT 'scale-' || n FROM generate_series(2,60) n)",
  )
  const first = await getPage('/applications?limit=24&sort=name&q=同名应用')
  // Insert before the current cursor and delete its anchor; continuation must not shift by an offset.
  await fixture.client.exec(
    `INSERT INTO applications (name,application_code,package_name,platform,region_id) VALUES ('000 新增','cursor-new','com.cursor.new','android','${productId}');`,
  )
  const anchor = first.items.at(-1)!.id
  await fixture.client.query('DELETE FROM applications WHERE id=$1', [anchor])
  const next = await getPage(
    `/applications?limit=24&sort=name&q=同名应用&cursor=${first.nextCursor}`,
  )
  expect(next.items).toHaveLength(24)
  expect(next.items.some((row) => first.items.some((old) => old.id === row.id))).toBe(
    false,
  )
})

it('目录计数、搜索与翻页只包含可访问应用，并拒绝跨筛选游标', async () => {
  const summaryResponse = await app.request('/applications/summary', {
    headers: { Authorization: `Bearer ${viewerToken}` },
  })
  const summary = (await summaryResponse.json()) as {
    total: number
    productCounts: Record<string, number>
    maintainableCounts: Record<string, number>
  }
  expect(summary.total).toBe(1)
  expect(summary.productCounts[productId]).toBe(1)
  expect(summary.maintainableCounts[productId]).toBe(0)
  expect(JSON.stringify(summary).length).toBeLessThan(500)
  expect((await getPage('/applications?limit=24', viewerToken)).total).toBe(1)
  expect((await getPage('/applications?limit=24&scope=mine', viewerToken)).total).toBe(0)
  const first = await getPage('/applications?limit=24')
  const mismatch = await app.request(
    `/applications?limit=24&q=hidden&cursor=${first.nextCursor}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(mismatch.status).toBe(400)
  expect((await getPage('/applications?limit=24&q=01000')).total).toBe(1)
  await fixture.client.exec(
    `INSERT INTO user_application_preferences (user_id,application_id,favorite) VALUES ('${viewerId}','${historyAppId}',true);`,
  )
  expect(
    (await getPage('/applications?limit=24&favorites=1', viewerToken)).items.map(
      (row) => row.id,
    ),
  ).toEqual([historyAppId])
  const mine = await app.request(`/applications/${historyAppId}/overview`, {
    headers: { Authorization: `Bearer ${viewerToken}` },
  })
  expect(mine.status).toBe(200)
  const otherId = first.items.find((row) => row.id !== historyAppId)!.id
  const denied = await app.request(`/applications/${otherId}/artifacts?limit=24`, {
    headers: { Authorization: `Bearer ${viewerToken}` },
  })
  expect(denied.status).toBe(403)
})

it('概览只取最近 3 条，同时保留历史上手动标记的最新制品；发布计数准确', async () => {
  const response = await app.request(`/applications/${historyAppId}/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const overview = (await response.json()) as {
    recent: { version: string }[]
    latest: { version: string }
  }
  expect(overview.recent).toHaveLength(3)
  expect(overview.recent[0].version).toBe('1.0.300')
  expect(overview.latest.version).toBe('1.0.1')
  const page = await getPage(`/applications/${historyAppId}/releases?limit=20`)
  expect(page.items).toHaveLength(20)
  expect(
    page.items.every(
      (release) => release.artifactCount === 1 && release.artifactTypes.join() === 'apk',
    ),
  ).toBe(true)
  expect(
    (await getPage(`/applications/${historyAppId}/artifacts?limit=24&q=1.0.299`)).items[0]
      .version,
  ).toBe('1.0.299')
})

it('一个应用积累 300 个制品和发布时，只读取当前页历史', async () => {
  for (const collection of ['artifacts', 'releases']) {
    const started = performance.now()
    const response = await app.request(
      `/applications/${historyAppId}/${collection}?limit=24`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const raw = await response.text()
    const body = JSON.parse(raw) as { items: { id: string }[]; total: number }
    console.info(
      JSON.stringify({
        scenario: `300 ${collection} / first 24`,
        ms: Math.round(performance.now() - started),
        bytes: Buffer.byteLength(raw),
        returned: body.items.length,
      }),
    )
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(24)
    expect(body.total).toBe(300)
  }
})

it('全局搜索两条匹配路径去重、先鉴权再限制数量，并保留特殊字符和字段边界规则', async () => {
  const otherId = (
    await fixture.client.query<{ id: string }>(
      "SELECT id FROM applications WHERE application_code='scale-1000'",
    )
  ).rows[0].id
  await fixture.client.query("UPDATE applications SET name='重复匹配 1.0.' WHERE id=$1", [
    historyAppId,
  ])
  await fixture.client.exec(`
    INSERT INTO releases (application_id,version) VALUES ('${otherId}','1.0.private');
    INSERT INTO artifacts (application_id,release_id,version,platform,type,original_filename,filename,storage_key)
    SELECT application_id,id,version,'android','apk','split','boundary.apk','search/private' FROM releases WHERE application_id='${otherId}';
    INSERT INTO releases (application_id,version) VALUES ('${historyAppId}','special');
    INSERT INTO artifacts (application_id,release_id,version,platform,type,original_filename,filename,storage_key)
    SELECT application_id,id,version,'android','apk','literal%_.apk','literal%_.apk','search/literal' FROM releases WHERE application_id='${historyAppId}' AND version='special';
  `)
  const search = async (q: string, access = viewerToken) => {
    const response = await app.request(`/search?q=${encodeURIComponent(q)}&artifacts=8`, {
      headers: { Authorization: `Bearer ${access}` },
    })
    expect(response.status).toBe(200)
    return (await response.json()) as {
      artifacts: { artifact: { id: string; applicationId: string; filename: string } }[]
    }
  }
  const combined = await search('1.0.')
  expect(combined.artifacts).toHaveLength(8)
  expect(new Set(combined.artifacts.map((r) => r.artifact.id)).size).toBe(8)
  expect(combined.artifacts.every((r) => r.artifact.applicationId === historyAppId)).toBe(
    true,
  )
  expect((await search('private')).artifacts).toHaveLength(0)
  expect((await search('private', token)).artifacts).toHaveLength(1)
  expect((await search('%_')).artifacts.map((r) => r.artifact.filename)).toEqual([
    'literal%_.apk',
  ])
  expect((await search('boundary.apk split', token)).artifacts).toHaveLength(0)
})
