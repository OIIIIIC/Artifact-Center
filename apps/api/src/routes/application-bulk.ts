import { eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import { applications } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { type AuthVariables } from '../middleware/auth.js'
import { requireRoles } from '../middleware/require-role.js'
import {
  bulkApplicationAppearanceSchema,
  bulkApplicationCodesSchema,
} from './application-inputs.js'

export function registerApplicationBulk(
  applicationRoutes: Hono<{ Variables: AuthVariables }>,
) {
  applicationRoutes.patch('/bulk-codes', requireRoles('admin'), async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = bulkApplicationCodesSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(
        c,
        400,
        'invalid_body',
        'Invalid application code updates',
        parsed.error.flatten(),
      )
    }

    const updates = parsed.data.updates
    const applicationIds = updates.map((update) => update.id)
    if (new Set(applicationIds).size !== applicationIds.length) {
      return jsonError(c, 400, 'duplicate_application', 'Application IDs must be unique')
    }

    const existing = await db
      .select({ id: applications.id })
      .from(applications)
      .where(inArray(applications.id, applicationIds))
    if (existing.length !== applicationIds.length) {
      return jsonError(c, 404, 'not_found', 'One or more applications were not found')
    }

    const updatedAt = new Date()
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(applications)
          .set({
            applicationCode: update.applicationCode.trim(),
            updatedAt,
          })
          .where(eq(applications.id, update.id))
      }
    })

    await writeAudit(c, {
      action: 'app.update',
      objectType: 'system',
      summary: `批量更新 ${updates.length} 个应用代码`,
      meta: {
        applicationIds,
        fields: ['applicationCode'],
      },
    })

    return c.json({ updated: updates.length })
  })

  applicationRoutes.patch('/bulk-appearance', requireRoles('admin'), async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = bulkApplicationAppearanceSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(
        c,
        400,
        'invalid_body',
        'Invalid application appearance update',
        parsed.error.flatten(),
      )
    }

    const applicationIds = [...new Set(parsed.data.applicationIds)]
    const existing = await db
      .select({ id: applications.id })
      .from(applications)
      .where(inArray(applications.id, applicationIds))
    if (existing.length !== applicationIds.length) {
      return jsonError(c, 404, 'not_found', 'One or more applications were not found')
    }

    await db
      .update(applications)
      .set({
        ...(parsed.data.iconKey !== undefined ? { iconKey: parsed.data.iconKey } : {}),
        ...(parsed.data.iconColor !== undefined
          ? { iconColor: parsed.data.iconColor }
          : {}),
        updatedAt: new Date(),
      })
      .where(inArray(applications.id, applicationIds))

    await writeAudit(c, {
      action: 'app.update',
      objectType: 'system',
      summary: `批量更新 ${applicationIds.length} 个应用头像`,
      meta: {
        applicationIds,
        fields: [
          ...(parsed.data.iconKey !== undefined ? ['iconKey'] : []),
          ...(parsed.data.iconColor !== undefined ? ['iconColor'] : []),
        ],
      },
    })

    return c.json({ updated: applicationIds.length })
  })
}
