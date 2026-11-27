import { sql } from 'drizzle-orm'
import { auditLogs } from '../db/schema.js'

/** Each membership path can use its own index; UNION deduplicates collection events. */
export function applicationAuditFilter(applicationId: string) {
  return sql`${auditLogs.id} in (
    select id from audit_logs where application_id = ${applicationId}
    union
    select id from audit_logs
    where action in ('share.create', 'share.revoke')
      and meta->'applicationIds' @> ${JSON.stringify([applicationId])}::jsonb
    union
    select legacy.id from share_link_items item
    cross join lateral (
      select log.id from audit_logs log
      where log.object_id = item.share_link_id::text
        and log.action in ('share.create', 'share.revoke')
        and (log.meta->'applicationIds') is null
      -- Preserve per-share index lookups instead of scanning all legacy events.
      offset 0
    ) legacy
    where item.application_id = ${applicationId}
  )`
}
