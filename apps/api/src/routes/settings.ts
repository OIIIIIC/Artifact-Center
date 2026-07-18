import { Hono } from 'hono'
import { z } from 'zod'

import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import {
  getRetentionPolicy,
  runRetentionCleanup,
  updateRetentionSettings,
} from '../lib/retention.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { requireRoles } from '../middleware/require-role.js'

const patchSchema = z.object({
  maxVersions: z.number().int().min(1).max(999).optional(),
  archiveDeprecatedDays: z.number().int().min(1).max(3650).optional(),
  storageQuotaBytes: z
    .number()
    .int()
    .min(1024 * 1024 * 100)
    .max(1024 ** 5)
    .optional(),
})

export const settingsRoutes = new Hono<{ Variables: AuthVariables }>()

settingsRoutes.use('*', requireAuth)

/** GET /settings/retention */
settingsRoutes.get('/retention', async (c) => {
  const policy = await getRetentionPolicy()
  return c.json({ retention: policy })
})

/** PATCH /settings/retention — admin only */
settingsRoutes.patch('/retention', requireRoles('admin'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid retention payload',
      parsed.error.flatten(),
    )
  }
  if (
    parsed.data.maxVersions === undefined &&
    parsed.data.archiveDeprecatedDays === undefined &&
    parsed.data.storageQuotaBytes === undefined
  ) {
    return jsonError(c, 400, 'invalid_body', 'No fields to update')
  }

  const policy = await updateRetentionSettings(parsed.data)

  await writeAudit(c, {
    action: 'settings.retention_update',
    objectType: 'system',
    objectId: 'retention',
    summary: `更新保留策略（最多 ${policy.maxVersions} 版 / 弃用 ${policy.archiveDeprecatedDays} 天）`,
    meta: {
      maxVersions: policy.maxVersions,
      archiveDeprecatedDays: policy.archiveDeprecatedDays,
      storageQuotaBytes: policy.storageQuotaBytes,
    },
  })

  return c.json({ retention: policy })
})

/** POST /settings/retention/run — admin: run cleanup now */
settingsRoutes.post('/retention/run', requireRoles('admin'), async (c) => {
  const report = await runRetentionCleanup()

  await writeAudit(c, {
    action: 'settings.retention_run',
    objectType: 'system',
    objectId: 'retention',
    summary: `执行保留清理：删除 ${report.deletedVersions} 个版本，归档 ${report.archivedDeprecated} 个`,
    meta: report,
  })

  const policy = await getRetentionPolicy()
  return c.json({ report, retention: policy })
})
