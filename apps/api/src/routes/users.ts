import { and, asc, count, eq, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { hashPassword } from '../lib/password.js'
import { validatePassword } from '../lib/password-policy.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/require-admin.js'

const roleEnum = z.enum(['admin', 'maintainer', 'viewer'])

const createSchema = z.object({
  name: z.string().min(1).max(120),
  username: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,63}$/),
  email: z.string().email().max(255),
  password: z.string().min(1).max(72),
  role: roleEnum.default('viewer'),
})

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
})

const resetPasswordSchema = z.object({
  password: z.string().min(1).max(72),
})

const transferAdminSchema = z.object({
  targetUserId: z.string().uuid(),
  nextRole: z.enum(['maintainer', 'viewer']).default('viewer'),
})

/** 串行化全局管理员变更，避免两个请求同时把最后两位管理员降级。 */
const ADMIN_ROLE_LOCK_KEY = 2_026_082_700

function mapUser(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    role: row.role,
    avatarUrl: row.avatarUrl,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function countAdmins(
  executor: Pick<typeof db, 'select'>,
  excludeId?: string,
): Promise<number> {
  const conditions = [eq(users.role, 'admin'), eq(users.isActive, true)]
  if (excludeId) {
    conditions.push(ne(users.id, excludeId))
  }
  const [row] = await executor
    .select({ n: count() })
    .from(users)
    .where(and(...conditions))
  return Number(row?.n ?? 0)
}

function roleUpdateValues(
  data: z.infer<typeof patchSchema>,
  current: typeof users.$inferSelect,
) {
  const revokesTokens =
    (data.role !== undefined && data.role !== current.role) ||
    (data.isActive !== undefined && data.isActive !== current.isActive)

  return {
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.role !== undefined ? { role: data.role } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    ...(revokesTokens ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}),
    updatedAt: new Date(),
  }
}

export const userRoutes = new Hono<{ Variables: AuthVariables }>()

userRoutes.use('*', requireAuth, requireAdmin)

/** GET /users — list all users (admin) */
userRoutes.get('/', async (c) => {
  const rows = await db.select().from(users).orderBy(asc(users.createdAt))
  return c.json({ items: rows.map(mapUser), total: rows.length })
})

/** POST /users — admin creates a user with initial password */
userRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid user payload',
      parsed.error.flatten(),
    )
  }

  const name = parsed.data.name.trim()
  const username = parsed.data.username.trim().toLowerCase()
  const email = parsed.data.email.trim().toLowerCase()
  const password = parsed.data.password
  const role = parsed.data.role

  if (!name) {
    return jsonError(c, 400, 'invalid_body', 'Name is required')
  }

  const policy = validatePassword(password)
  if (!policy.ok) {
    return jsonError(c, 400, policy.code, policy.message)
  }

  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (dup) {
    return jsonError(c, 409, 'email_taken', 'Email already registered')
  }

  const [usernameDup] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  if (usernameDup) {
    return jsonError(c, 409, 'username_taken', 'Username already registered')
  }

  const passwordHash = await hashPassword(password)
  const [row] = await db
    .insert(users)
    .values({
      name,
      username,
      email,
      passwordHash,
      role,
    })
    .returning()

  await writeAudit(c, {
    action: 'user.create',
    objectType: 'user',
    objectId: row.id,
    summary: `创建用户 ${row.name}（${row.username}，${row.role}）`,
    meta: { username: row.username, email: row.email, role: row.role },
  })

  return c.json({ user: mapUser(row) }, 201)
})

/** GET /users/:id */
userRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!row) return jsonError(c, 404, 'not_found', 'User not found')
  return c.json({ user: mapUser(row) })
})

/** PATCH /users/:id — name / role */
userRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid update payload',
      parsed.error.flatten(),
    )
  }

  const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'User not found')

  const data = parsed.data
  const actor = c.get('user')
  if (current.id === actor.sub && data.isActive === false) {
    return jsonError(
      c,
      400,
      'cannot_deactivate_self',
      'Cannot deactivate your own account',
    )
  }

  if (current.id === actor.sub && data.role !== undefined && data.role !== current.role) {
    return jsonError(
      c,
      400,
      'self_role_change_requires_transfer',
      'Use the administrator transfer flow to change your own role',
    )
  }

  const changesRoleOrActiveStatus = data.role !== undefined || data.isActive !== undefined
  let row: typeof users.$inferSelect | undefined

  if (changesRoleOrActiveStatus) {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_ROLE_LOCK_KEY})`)
      const [lockedCurrent] = await tx
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
      if (!lockedCurrent) return { kind: 'not_found' as const }

      const removesActiveAdmin =
        lockedCurrent.role === 'admin' &&
        lockedCurrent.isActive &&
        ((data.role !== undefined && data.role !== 'admin') || data.isActive === false)
      if (removesActiveAdmin && (await countAdmins(tx, id)) < 1) {
        return { kind: 'last_admin' as const }
      }

      const [updated] = await tx
        .update(users)
        .set(roleUpdateValues(data, lockedCurrent))
        .where(eq(users.id, id))
        .returning()
      return { kind: 'updated' as const, row: updated }
    })

    if (result.kind === 'not_found')
      return jsonError(c, 404, 'not_found', 'User not found')
    if (result.kind === 'last_admin') {
      return jsonError(c, 400, 'last_admin', 'At least one active admin is required')
    }
    row = result.row
  } else {
    ;[row] = await db
      .update(users)
      .set(roleUpdateValues(data, current))
      .where(eq(users.id, id))
      .returning()
  }

  await writeAudit(c, {
    action: 'user.update',
    objectType: 'user',
    objectId: row.id,
    summary: `更新用户 ${row.name}`,
    meta: { fields: Object.keys(data), role: row.role, isActive: row.isActive },
  })

  return c.json({ user: mapUser(row) })
})

/** POST /users/me/transfer-admin — atomically promote a recipient and demote the actor. */
userRoutes.post('/me/transfer-admin', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = transferAdminSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid administrator transfer payload',
      parsed.error.flatten(),
    )
  }

  const actor = c.get('user')
  const { targetUserId, nextRole } = parsed.data
  if (targetUserId === actor.sub) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Administrator transfer target must be another user',
    )
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_ROLE_LOCK_KEY})`)
    const [actorUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, actor.sub))
      .limit(1)
    if (!actorUser || actorUser.role !== 'admin' || !actorUser.isActive) {
      return { kind: 'forbidden' as const }
    }

    const [target] = await tx
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1)
    if (!target) return { kind: 'target_not_found' as const }
    if (!target.isActive) return { kind: 'target_inactive' as const }

    const [nextAdmin] = await tx
      .update(users)
      .set({
        role: 'admin',
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.id))
      .returning()
    const [formerAdmin] = await tx
      .update(users)
      .set({
        role: nextRole,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actorUser.id))
      .returning()
    return { kind: 'transferred' as const, nextAdmin, formerAdmin }
  })

  if (result.kind === 'forbidden') {
    return jsonError(c, 403, 'forbidden', 'Administrator role required')
  }
  if (result.kind === 'target_not_found') {
    return jsonError(c, 404, 'transfer_target_not_found', 'Transfer target not found')
  }
  if (result.kind === 'target_inactive') {
    return jsonError(c, 400, 'transfer_target_inactive', 'Transfer target must be active')
  }

  await writeAudit(c, {
    action: 'user.admin_transfer',
    objectType: 'user',
    objectId: result.formerAdmin.id,
    summary: `移交管理员权限给 ${result.nextAdmin.name}`,
    meta: {
      fromUserId: result.formerAdmin.id,
      toUserId: result.nextAdmin.id,
      formerAdminRole: result.formerAdmin.role,
    },
  })

  return c.json({ user: mapUser(result.formerAdmin), target: mapUser(result.nextAdmin) })
})

/** POST /users/:id/reset-password — admin sets password */
userRoutes.post('/:id/reset-password', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(c, 400, 'invalid_body', 'Password required', parsed.error.flatten())
  }

  const [current] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'User not found')

  const policy = validatePassword(parsed.data.password)
  if (!policy.ok) {
    return jsonError(c, 400, policy.code, policy.message)
  }

  const passwordHash = await hashPassword(parsed.data.password)
  await db
    .update(users)
    .set({
      passwordHash,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))

  await writeAudit(c, {
    action: 'user.reset_password',
    objectType: 'user',
    objectId: current.id,
    summary: `重置用户密码 ${current.name}（${current.email}）`,
  })

  return c.json({ ok: true })
})

/** DELETE /users/:id */
userRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const actor = c.get('user')

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_ROLE_LOCK_KEY})`)
    const [current] = await tx.select().from(users).where(eq(users.id, id)).limit(1)
    if (!current) return { kind: 'not_found' as const }
    if (current.id === actor.sub) return { kind: 'cannot_delete_self' as const }
    if (current.role === 'admin' && current.isActive && (await countAdmins(tx, id)) < 1) {
      return { kind: 'last_admin' as const }
    }
    await tx.delete(users).where(eq(users.id, id))
    return { kind: 'deleted' as const, current }
  })

  if (result.kind === 'not_found') return jsonError(c, 404, 'not_found', 'User not found')
  if (result.kind === 'cannot_delete_self') {
    return jsonError(c, 400, 'cannot_delete_self', 'Cannot delete your own account')
  }
  if (result.kind === 'last_admin') {
    return jsonError(c, 400, 'last_admin', 'At least one active admin is required')
  }

  await writeAudit(c, {
    action: 'user.delete',
    objectType: 'user',
    objectId: result.current.id,
    summary: `删除用户 ${result.current.name}（${result.current.email}）`,
    meta: { role: result.current.role },
  })

  return c.json({ ok: true })
})
