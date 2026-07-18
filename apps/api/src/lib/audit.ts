import type { Context } from 'hono'

import { db } from '../db/client.js'
import { auditLogs } from '../db/schema.js'
import type { AuthVariables } from '../middleware/auth.js'

export type AuditAction =
  | 'app.create'
  | 'app.update'
  | 'app.delete'
  | 'artifact.upload'
  | 'artifact.download'
  | 'artifact.update'
  | 'artifact.delete'
  | 'share.create'
  | 'share.revoke'
  | 'share.download'
  | 'settings.retention_update'
  | 'settings.retention_run'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.reset_password'
  | 'auth.login'
  | 'auth.change_password'
  | 'auth.profile_update'

export type AuditObjectType = 'application' | 'artifact' | 'user' | 'session' | 'system'

export type WriteAuditInput = {
  action: AuditAction
  objectType: AuditObjectType
  objectId?: string | null
  applicationId?: string | null
  summary: string
  meta?: Record<string, unknown>
  /** Override actor when no auth context (e.g. public download) */
  actorId?: string | null
  actorName?: string
}

function clientIp(c: Context): string | undefined {
  const xf = c.req.header('x-forwarded-for')
  if (xf) return xf.split(',')[0]?.trim()
  return c.req.header('x-real-ip') ?? undefined
}

/**
 * Best-effort audit write — never throws to callers.
 */
export async function writeAudit(
  c: Context<{ Variables: AuthVariables }> | Context,
  input: WriteAuditInput,
): Promise<void> {
  try {
    let actorId = input.actorId ?? null
    let actorName = input.actorName?.trim() || ''

    try {
      const user = (c as Context<{ Variables: AuthVariables }>).get('user')
      if (user) {
        actorId = actorId ?? user.sub
        if (!actorName) actorName = user.name || user.email || ''
      }
    } catch {
      // no auth variables on this context
    }

    if (!actorName) actorName = actorId ? 'User' : 'Anonymous'

    await db.insert(auditLogs).values({
      actorId,
      actorName,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId ?? null,
      applicationId: input.applicationId ?? null,
      summary: input.summary.slice(0, 500),
      meta: input.meta ?? null,
      ip: clientIp(c) ?? null,
    })
  } catch (err) {
    console.error('[audit] write failed', err)
  }
}
