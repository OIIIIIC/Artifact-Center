import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import {
  applicationMembers,
  applications,
  regions,
  userApplicationPreferences,
  userWorkspacePreferences,
} from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import { hasApplicationRole } from '../middleware/application-access.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'

const applicationIdSchema = z.string().uuid()

export const workspacePreferencesSchema = z
  .object({
    platform: z.enum(['all', 'android', 'windows', 'zip']).optional(),
    sort: z.enum(['updated', 'name', 'created']).optional(),
    regionId: z.string().uuid().nullable().optional(),
    query: z.string().trim().max(120).optional(),
    favoriteOnly: z.boolean().optional(),
    responsibleOnly: z.boolean().optional(),
    collapsed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one preference is required',
  })

type PreferenceRow = typeof userApplicationPreferences.$inferSelect

export function serializeWorkspace(
  rows: PreferenceRow[],
  preferences: typeof userWorkspacePreferences.$inferSelect | undefined,
) {
  const favorites = rows
    .filter((row) => row.favorite)
    .sort(
      (left, right) =>
        (right.favoriteAt?.getTime() ?? 0) - (left.favoriteAt?.getTime() ?? 0),
    )
    .map((row) => row.applicationId)
  const recent = rows
    .filter((row) => row.lastViewedAt != null)
    .sort(
      (left, right) =>
        (right.lastViewedAt?.getTime() ?? 0) - (left.lastViewedAt?.getTime() ?? 0),
    )
    .slice(0, 4)
    .map((row) => ({
      applicationId: row.applicationId,
      viewedAt: row.lastViewedAt!.toISOString(),
    }))

  return {
    favoriteApplicationIds: favorites,
    recentApplications: recent,
    preferences: {
      platform: preferences?.platform ?? 'all',
      sort: preferences?.sort ?? 'updated',
      regionId: preferences?.regionId ?? null,
      query: preferences?.query ?? '',
      favoriteOnly: preferences?.favoriteOnly ?? false,
      responsibleOnly: preferences?.responsibleOnly ?? false,
      collapsed: preferences?.collapsed ?? false,
    },
  }
}

export const workspaceRoutes = new Hono<{ Variables: AuthVariables }>()

workspaceRoutes.use('*', requireAuth)

workspaceRoutes.get('/', async (c) => {
  const user = c.get('user')
  const rows =
    user.role === 'admin'
      ? await db
          .select()
          .from(userApplicationPreferences)
          .where(eq(userApplicationPreferences.userId, user.sub))
      : (
          await db
            .select({ preference: userApplicationPreferences })
            .from(userApplicationPreferences)
            .innerJoin(
              applicationMembers,
              and(
                eq(
                  applicationMembers.applicationId,
                  userApplicationPreferences.applicationId,
                ),
                eq(applicationMembers.userId, user.sub),
              ),
            )
            .where(eq(userApplicationPreferences.userId, user.sub))
        ).map((row) => row.preference)

  const [preferences] = await db
    .select()
    .from(userWorkspacePreferences)
    .where(eq(userWorkspacePreferences.userId, user.sub))
    .limit(1)

  return c.json(serializeWorkspace(rows, preferences))
})

workspaceRoutes.put('/favorites/:applicationId', async (c) => {
  const user = c.get('user')
  const parsedId = applicationIdSchema.safeParse(c.req.param('applicationId'))
  const parsedBody = z
    .object({ favorite: z.boolean() })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsedId.success || !parsedBody.success) {
    return jsonError(c, 400, 'invalid_body', 'Invalid favorite payload')
  }

  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.id, parsedId.data))
    .limit(1)
  if (!application) return jsonError(c, 404, 'not_found', 'Application not found')
  if (!(await hasApplicationRole(user, application.id, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  const now = new Date()
  await db
    .insert(userApplicationPreferences)
    .values({
      userId: user.sub,
      applicationId: application.id,
      favorite: parsedBody.data.favorite,
      favoriteAt: parsedBody.data.favorite ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        userApplicationPreferences.userId,
        userApplicationPreferences.applicationId,
      ],
      set: {
        favorite: parsedBody.data.favorite,
        favoriteAt: parsedBody.data.favorite ? now : null,
        updatedAt: now,
      },
    })

  return c.json({ favorite: parsedBody.data.favorite })
})

workspaceRoutes.post('/visits/:applicationId', async (c) => {
  const user = c.get('user')
  const parsedId = applicationIdSchema.safeParse(c.req.param('applicationId'))
  if (!parsedId.success) {
    return jsonError(c, 400, 'invalid_body', 'Invalid application id')
  }

  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.id, parsedId.data))
    .limit(1)
  if (!application) return jsonError(c, 404, 'not_found', 'Application not found')
  if (!(await hasApplicationRole(user, application.id, 'viewer'))) {
    return jsonError(c, 403, 'forbidden', 'Insufficient application role')
  }

  const now = new Date()
  await db
    .insert(userApplicationPreferences)
    .values({
      userId: user.sub,
      applicationId: application.id,
      lastViewedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        userApplicationPreferences.userId,
        userApplicationPreferences.applicationId,
      ],
      set: { lastViewedAt: now, updatedAt: now },
    })

  return c.json({ viewedAt: now.toISOString() })
})

workspaceRoutes.put('/preferences', async (c) => {
  const user = c.get('user')
  const parsed = workspacePreferencesSchema.safeParse(
    await c.req.json().catch(() => null),
  )
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid workspace preferences',
      parsed.error.flatten(),
    )
  }

  if (parsed.data.regionId) {
    const [region] = await db
      .select({ id: regions.id })
      .from(regions)
      .where(eq(regions.id, parsed.data.regionId))
      .limit(1)
    if (!region) return jsonError(c, 400, 'region_unavailable', 'Region is unavailable')
  }

  const now = new Date()
  const [current] = await db
    .select()
    .from(userWorkspacePreferences)
    .where(eq(userWorkspacePreferences.userId, user.sub))
    .limit(1)
  const values = {
    userId: user.sub,
    platform: parsed.data.platform ?? current?.platform ?? 'all',
    sort: parsed.data.sort ?? current?.sort ?? 'updated',
    regionId:
      parsed.data.regionId !== undefined
        ? parsed.data.regionId
        : (current?.regionId ?? null),
    query: parsed.data.query ?? current?.query ?? '',
    favoriteOnly: parsed.data.favoriteOnly ?? current?.favoriteOnly ?? false,
    responsibleOnly: parsed.data.responsibleOnly ?? current?.responsibleOnly ?? false,
    collapsed: parsed.data.collapsed ?? current?.collapsed ?? false,
    updatedAt: now,
  }

  await db.insert(userWorkspacePreferences).values(values).onConflictDoUpdate({
    target: userWorkspacePreferences.userId,
    set: values,
  })

  return c.json({
    preferences: {
      platform: values.platform,
      sort: values.sort,
      regionId: values.regionId,
      query: values.query,
      favoriteOnly: values.favoriteOnly,
      responsibleOnly: values.responsibleOnly,
      collapsed: values.collapsed,
    },
  })
})
