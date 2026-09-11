/** Run only against an empty, disposable local PostgreSQL database. Never seeds the application database. */
import { writeFile } from 'node:fs/promises'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { Hono } from 'hono'

const target = new URL(process.env.BENCH_DATABASE_URL ?? '')
if (
  !['localhost', '127.0.0.1'].includes(target.hostname) ||
  !/^\/artifact_center_bench_[a-z0-9_]+$/.test(target.pathname)
)
  throw new Error(
    'An explicitly named local artifact_center_bench_* database is required',
  )
process.env.DATABASE_URL = target.toString()
const sql = postgres(target.toString(), { max: 1 })
const [{ count }] = await sql<
  { count: number }[]
>`select count(*)::int as count from information_schema.tables where table_schema='public'`
if (count && !process.argv.includes('--reuse'))
  throw new Error('Benchmark requires an empty database; it never deletes existing data')
await migrate(drizzle(sql), {
  migrationsFolder: new URL('../drizzle/', import.meta.url).pathname.replace(
    /^\/(\w:)/,
    '$1',
  ),
})
if (!count) {
  await sql.unsafe(`
  INSERT INTO users (id,username,email,name,password_hash,role) VALUES ('00000000-0000-4000-8000-000000000001','benchmark','benchmark@example.test','Benchmark','test','admin');
  INSERT INTO regions (code,name) SELECT 'bench-' || n, '验证产品 ' || n FROM generate_series(1,10) n;
  INSERT INTO applications (name,application_code,package_name,platform,region_id,description)
  SELECT '应用 ' || lpad(n::text,3,'0'), 'bench-' || n, 'com.benchmark.app' || n, 'android', r.id, repeat('应用容量验证说明。',20)
  FROM generate_series(1,300) n JOIN regions r ON r.code='bench-' || ((n-1)%10+1);
  INSERT INTO releases (application_id,version,release_notes,published_at)
  SELECT a.id, '1.0.' || n, repeat('发布说明：修复与功能更新。',40), '2026-08-01'::timestamptz + n * interval '1 second'
  FROM applications a CROSS JOIN generate_series(1,300) n;
  INSERT INTO artifacts (application_id,release_id,version,platform,type,original_filename,filename,storage_key,size_bytes,release_notes,uploaded_at)
  SELECT application_id,id,version,'android','apk','app.apk','app.apk','benchmark/' || id,1000000,release_notes,published_at FROM releases;
  ANALYZE;
`)
}
const { applicationRoutes } = await import('../src/routes/applications.js')
const { signAccessToken } = await import('../src/lib/jwt.js')
const { pgClient } = await import('../src/db/client.js')
const { searchRoutes } = await import('../src/routes/search.js')
const app = new Hono()
  .route('/applications', applicationRoutes)
  .route('/search', searchRoutes)
const token = await signAccessToken({
  sub: '00000000-0000-4000-8000-000000000001',
  name: 'Benchmark',
  email: 'benchmark@example.test',
  role: 'admin',
  tokenVersion: 0,
})
const [{ id }] = await sql<
  { id: string }[]
>`select id from applications order by name limit 1`
const scenarios = [
  ['application-full', '/applications'],
  ['application-page', '/applications?limit=24'],
  ['directory-summary', '/applications/summary'],
  ['artifact-full', `/applications/${id}/artifacts`],
  ['artifact-page', `/applications/${id}/artifacts?limit=30`],
  ['release-full', `/applications/${id}/releases`],
  ['release-page', `/applications/${id}/releases?limit=20`],
  ['overview', `/applications/${id}/overview`],
  ['search-version', '/search?q=1.0.299&apps=8&artifacts=8'],
  ['search-absent', '/search?q=missing-xyz&apps=8&artifacts=8'],
  ['search-short', '/search?q=1&apps=8&artifacts=8'],
  [
    'search-application',
    '/search?q=' + encodeURIComponent('应用 300') + '&apps=8&artifacts=8',
  ],
] as const
// Interleave paths to reduce systematic cache/JIT bias; discard two complete warm-up rounds.
const measurements = scenarios.map(([name, url]) => ({
  name,
  url,
  timings: [] as number[],
  bytes: 0,
  returned: 0,
}))
for (let round = 0; round < 22; round++) {
  for (let i = 0; i < measurements.length; i++) {
    const sample = measurements[(i + round) % measurements.length]
    const start = performance.now()
    const response = await app.request(sample.url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok)
      throw new Error(`${sample.name}: ${response.status} ${await response.text()}`)
    const text = await response.text()
    const elapsed = performance.now() - start
    const body = JSON.parse(text)
    sample.bytes = Buffer.byteLength(text)
    sample.returned = body.items?.length ?? body.recent?.length ?? body.total
    if (round >= 2) sample.timings.push(elapsed)
  }
}
const results = measurements.map(({ name, bytes, returned, timings }) => {
  timings.sort((a, b) => a - b)
  const result = {
    name,
    bytes,
    returned,
    medianMs: +timings[Math.floor(timings.length / 2)].toFixed(2),
    p95Ms: +timings[Math.ceil(timings.length * 0.95) - 1].toFixed(2),
  }
  console.log(JSON.stringify(result))
  return result
})
if (
  process.argv.includes('--check') &&
  results.some((r) => r.name.startsWith('search-') && r.medianMs > 250)
)
  throw new Error('Global search exceeds the 250 ms local median budget')
const plans = await sql.unsafe(
  `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM artifacts WHERE application_id='${id}' ORDER BY uploaded_at DESC,id DESC LIMIT 31`,
)
const searchPlans =
  await sql.unsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM artifacts
  WHERE (version || ' ' || filename || ' ' || original_filename || ' ' || build_number || ' ' || uploader_name || ' ' || release_notes) ILIKE '%missing-xyz%' LIMIT 8`)
const report = {
  database: 'PostgreSQL 16',
  applicationCount: 300,
  artifactCount: 90000,
  releaseCount: 90000,
  concurrency: 1,
  samples: 20,
  warmup: 2,
  measurement:
    'interleaved routes, Hono in-process HTTP + PostgreSQL, response text included',
  results,
  plans,
  searchPlans,
}
if (process.env.BENCH_REPORT_PATH)
  await writeFile(process.env.BENCH_REPORT_PATH, JSON.stringify(report, null, 2))
// Optional browser preview uses this same disposable dataset and the actual application routes.
if (process.env.BENCH_SERVE === 'true') {
  const { serve } = await import('@hono/node-server')
  const { authRoutes } = await import('../src/routes/auth.js')
  const { settingsRoutes } = await import('../src/routes/settings.js')
  const { workspaceRoutes } = await import('../src/routes/workspace.js')
  const { hash } = await import('bcryptjs')
  await sql`update users set password_hash=${await hash('Benchmark-Preview-2026!', 10)} where username='benchmark'`
  const preview = new Hono()
    .route('/applications', applicationRoutes)
    .route('/auth', authRoutes)
    .route('/search', searchRoutes)
    .route('/settings', settingsRoutes)
    .route('/workspace', workspaceRoutes)
  serve({ fetch: preview.fetch, hostname: '127.0.0.1', port: 4018 })
  console.log('Benchmark preview http://127.0.0.1:4018')
} else {
  await pgClient.end()
  await sql.end()
}
