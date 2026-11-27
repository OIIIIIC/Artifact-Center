import type { PGlite } from '@electric-sql/pglite'
import { Hono } from 'hono'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
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
const adminId = randomUUID(),
  productId = randomUUID()
let token: string
beforeAll(async () => {
  const folder = new URL('../../drizzle/', import.meta.url)
  const journal = JSON.parse(
    await readFile(new URL('meta/_journal.json', folder), 'utf8'),
  ) as { entries: { tag: string }[] }
  for (const entry of journal.entries)
    await fixture.client.exec(await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8'))
  await fixture.client.query(
    `INSERT INTO users(id,username,email,name,password_hash,role) VALUES($1,'owned-admin','admin@owned.test','Admin','unused','admin')`,
    [adminId],
  )
  await fixture.client.query(
    `INSERT INTO regions(id,code,name) VALUES($1,'owned','Owned')`,
    [productId],
  )
  token = await signAccessToken({
    sub: adminId,
    email: 'admin@owned.test',
    name: 'Admin',
    role: 'admin',
    tokenVersion: 0,
  })
}, 30000)
afterAll(async () => {
  await fixture.client.close()
})
async function createApplication() {
  const id = randomUUID()
  await fixture.client.query(
    `INSERT INTO applications(id,name,application_code,package_name,platform,region_id) VALUES($1,'Owned','owned','owned.test','linux',$2)`,
    [id, productId],
  )
  return id
}
async function createBuild(source: string, target: string) {
  const id = randomUUID()
  await fixture.client.query(
    `INSERT INTO application_builds(id,application_id,request_key,requested_by_name,base_url,username,job_path,config_revision,artifact_pattern,status) VALUES($1,$2,$3,'Admin','http://test-only','test','test',1,'*.zip','success')`,
    [id, source, randomUUID()],
  )
  await fixture.client.query(
    `INSERT INTO build_publications(build_id,target_application_id,relative_path,version,requested_by_name,status) VALUES($1,$2,'owned.zip','1','Admin','published')`,
    [id, target],
  )
  return id
}
const remove = (id: string) =>
  app.request(`/applications/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

it('删除含本应用构建发布历史的应用，连同自有构建历史原子删除', async () => {
  const id = await createApplication()
  const build = await createBuild(id, id)
  const response = await remove(id)
  expect(response.status).toBe(200)
  const rows = await fixture.client.query(
    'SELECT id FROM application_builds WHERE id=$1',
    [build],
  )
  expect(rows.rows).toHaveLength(0)
  expect(
    (await fixture.client.query('SELECT id FROM applications WHERE id=$1', [id])).rows,
  ).toHaveLength(0)
})

it('其他应用仍引用目标时返回 409，且保留双方全部历史', async () => {
  const target = await createApplication(),
    source = await createApplication()
  const own = await createBuild(target, target)
  const external = await createBuild(source, target)
  const response = await remove(target)
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({
    error: { code: 'application_build_target_in_use' },
  })
  expect(
    (
      await fixture.client.query(
        'SELECT id FROM application_builds WHERE id IN ($1,$2)',
        [own, external],
      )
    ).rows,
  ).toHaveLength(2)
  expect(
    (await fixture.client.query('SELECT id FROM applications WHERE id=$1', [target]))
      .rows,
  ).toHaveLength(1)
})

it('删除源应用不会删除其他目标应用', async () => {
  const source = await createApplication(),
    target = await createApplication()
  await createBuild(source, target)
  expect((await remove(source)).status).toBe(200)
  expect(
    (await fixture.client.query('SELECT id FROM applications WHERE id=$1', [target]))
      .rows,
  ).toHaveLength(1)
})
