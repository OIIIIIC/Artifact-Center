import { and, asc, count, eq, ne } from 'drizzle-orm'
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
})

const resetPasswordSchema = z.object({
  password: z.string().min(1).max(72),
})

function mapUser(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    role: row.role,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function countAdmins(excludeId?: string): Promise<number> {
  const conditions = [eq(users.role, 'admin')]
  if (excludeId) {
    conditions.push(ne(users.id, excludeId))
  }
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(...conditions))
  return Number(row?.n ?? 0)
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
  if (data.role !== undefined && data.role !== 'admin' && current.role === 'admin') {
    const others = await countAdmins(id)
    if (others < 1) {
      return jsonError(c, 400, 'last_admin', 'At least one admin is required')
    }
  }

  const [row] = await db
    .update(users)
    .set({
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning()

  await writeAudit(c, {
    action: 'user.update',
    objectType: 'user',
    objectId: row.id,
    summary: `更新用户 ${row.name}`,
    meta: { fields: Object.keys(data), role: row.role },
  })

  return c.json({ user: mapUser(row) })
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
    .set({ passwordHash, updatedAt: new Date() })
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

  const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!current) return jsonError(c, 404, 'not_found', 'User not found')

  if (current.id === actor.sub) {
    return jsonError(c, 400, 'cannot_delete_self', 'Cannot delete your own account')
  }

  if (current.role === 'admin') {
    const others = await countAdmins(id)
    if (others < 1) {
      return jsonError(c, 400, 'last_admin', 'At least one admin is required')
    }
  }

  await db.delete(users).where(eq(users.id, id))

  await writeAudit(c, {
    action: 'user.delete',
    objectType: 'user',
    objectId: current.id,
    summary: `删除用户 ${current.name}（${current.email}）`,
    meta: { role: current.role },
  })

  return c.json({ ok: true })
})
