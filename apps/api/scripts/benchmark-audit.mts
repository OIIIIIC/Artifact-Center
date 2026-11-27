/** Explicitly named, empty local benchmark databases only; never changes business data. */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { desc } from 'drizzle-orm'
import { applicationAuditFilter } from '../src/lib/application-audit-filter.js'
import { auditLogs } from '../src/db/schema.js'

const target = new URL(process.env.BENCH_DATABASE_URL ?? '')
if (
  !['localhost', '127.0.0.1'].includes(target.hostname) ||
  !/^\/artifact_center_bench_[a-z0-9_]+$/.test(target.pathname)
)
  throw new Error(
    'An explicitly named local artifact_center_bench_* database is required',
  )
const client = postgres(target.toString(), { max: 1 })
try {
  const [{ count }] =
    await client`select count(*)::int as count from information_schema.tables where table_schema='public'`
  if (count) throw new Error('Benchmark requires an empty database; no data is deleted')
  const db = drizzle(client)
  await migrate(db, {
    migrationsFolder: new URL('../drizzle/', import.meta.url).pathname.replace(
      /^\/(\w:)/,
      '$1',
    ),
  })
  await client.unsafe(`
    INSERT INTO regions (id, code, name) VALUES ('00000000-0000-4000-8000-000000000010', 'bench', 'Benchmark');
    INSERT INTO applications (id, name, application_code, package_name, platform, region_id)
    SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'App ' || n, 'app-' || n, 'com.bench.' || n, 'android', '00000000-0000-4000-8000-000000000010' FROM generate_series(1000,1299) n;
    INSERT INTO audit_logs (action, object_type, object_id, application_id, summary, meta, created_at)
    SELECT CASE WHEN n%10=0 THEN 'share.create' ELSE 'artifact.upload' END, 'application', CASE WHEN n%20=0 THEN ('10000000-0000-4000-8000-' || lpad(n::text,12,'0')) ELSE 'event-' || n END,
      ('00000000-0000-4000-8000-' || lpad((1000+(n-1)/300)::text,12,'0'))::uuid,
      'Benchmark event', CASE WHEN n%20=0 THEN '{}'::jsonb WHEN n%10=0 THEN jsonb_build_object('applicationIds', jsonb_build_array('00000000-0000-4000-8000-' || lpad((1000+(n-1)/300)::text,12,'0'))) ELSE '{}'::jsonb END,
      '2026-01-01'::timestamptz + n * interval '1 second' FROM generate_series(1,90000) n;
    INSERT INTO share_links (id, token_hash, application_id)
    SELECT ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, md5(n::text),
      ('00000000-0000-4000-8000-' || lpad((1000+(n-1)/300)::text,12,'0'))::uuid
    FROM generate_series(20,90000,20) n;
    INSERT INTO share_link_items (share_link_id, application_id)
    SELECT id, application_id FROM share_links;
    ANALYZE;
  `)
  const id = '00000000-0000-4000-8000-000000001000'
  const old = `SELECT * FROM audit_logs WHERE application_id='${id}' OR (action IN ('share.create','share.revoke') AND (meta->'applicationIds' @> '["${id}"]'::jsonb OR ((meta->'applicationIds') IS NULL AND EXISTS (SELECT 1 FROM share_link_items item WHERE item.share_link_id::text=audit_logs.object_id AND item.application_id='${id}')))) ORDER BY created_at DESC, id DESC LIMIT 50`
  const fixed = db
    .select()
    .from(auditLogs)
    .where(applicationAuditFilter(id))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(50)
    .toSQL()
  const reports: Record<string, unknown> = {}
  // Compare against the original index set as well as the fixed query and indexes.
  await client`DROP INDEX audit_logs_share_applications_idx`
  await client`DROP INDEX audit_logs_legacy_share_object_idx`
  const beforeRows = await client.unsafe(old)
  const beforePlans = []
  for (let i = 0; i < 4; i++)
    beforePlans.push(
      (await client.unsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${old}`))[0][
        'QUERY PLAN'
      ][0],
    )
  reports.before = beforePlans
  await client`CREATE INDEX audit_logs_share_applications_idx ON audit_logs USING gin ((meta->'applicationIds')) WHERE action in ('share.create', 'share.revoke')`
  await client`CREATE INDEX audit_logs_legacy_share_object_idx ON audit_logs (object_id) WHERE action in ('share.create', 'share.revoke') AND (meta->'applicationIds') is null`
  await client`ANALYZE audit_logs`
  const afterRows = await client.unsafe(fixed.sql, fixed.params as string[])
  assert.deepEqual(
    afterRows.map((row) => row.id),
    beforeRows.map((row) => row.id),
  )
  const afterPlans = []
  for (let i = 0; i < 4; i++)
    afterPlans.push(
      (
        await client.unsafe(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${fixed.sql}`,
          fixed.params as string[],
        )
      )[0]['QUERY PLAN'][0],
    )
  reports.after = afterPlans
  const reportPath =
    process.env.BENCH_REPORT_PATH ?? '../../docs/performance-audit-2026-09-15.json'
  await writeFile(reportPath, JSON.stringify(reports, null, 2) + '\n')
  const before = beforePlans.at(-1)
  const after = afterPlans.at(-1)
  console.log(
    JSON.stringify({
      beforeMs: beforePlans.slice(1).map((p) => p['Execution Time']),
      afterMs: afterPlans.slice(1).map((p) => p['Execution Time']),
      beforeBuffers: before.Plan['Shared Hit Blocks'],
      afterBuffers: after.Plan['Shared Hit Blocks'],
      reportPath,
    }),
  )
  assert(
    after.Plan['Shared Hit Blocks'] < before.Plan['Shared Hit Blocks'],
    'Fixed query must reduce work on unrelated share history',
  )
  function checkLegacy(node: Record<string, any>) {
    if (node['Index Name'] === 'audit_logs_legacy_share_object_idx')
      assert(
        node['Actual Rows'] * node['Actual Loops'] <= 15,
        'Only the target application legacy events may be scanned',
      )
    for (const child of node.Plans ?? []) checkLegacy(child)
  }
  checkLegacy(after.Plan)
} finally {
  await client.end()
}
