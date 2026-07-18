import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { jsonError } from '../lib/errors.js'
import { signAccessToken } from '../lib/jwt.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { validatePassword } from '../lib/password-policy.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const profileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(255).optional(),
  /** data URL or remote URL; null clears */
  avatarUrl: z.union([z.string().max(2_000_000), z.null()]).optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1).max(72),
})

function mapUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  }
}

async function issueToken(user: typeof users.$inferSelect) {
  return signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
}

export const authRoutes = new Hono<{ Variables: AuthVariables }>()

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Email and password required',
      parsed.error.flatten(),
    )
  }

  const email = parsed.data.email.trim().toLowerCase()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (!user) {
    return jsonError(c, 401, 'invalid_credentials', 'Invalid email or password')
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!ok) {
    return jsonError(c, 401, 'invalid_credentials', 'Invalid email or password')
  }

  const token = await issueToken(user)
  await writeAudit(c, {
    action: 'auth.login',
    objectType: 'session',
    objectId: user.id,
    summary: `登录 ${user.email}`,
    actorId: user.id,
    actorName: user.name,
  })
  return c.json({ token, user: mapUser(user) })
})

authRoutes.get('/me', requireAuth, async (c) => {
  const auth = c.get('user')
  const [user] = await db.select().from(users).where(eq(users.id, auth.sub)).limit(1)

  if (!user) {
    return jsonError(c, 401, 'unauthorized', 'User no longer exists')
  }

  return c.json({ user: mapUser(user) })
})

/** PATCH /auth/me — update own profile; returns refreshed JWT when claims change */
authRoutes.patch('/me', requireAuth, async (c) => {
  const auth = c.get('user')
  const body = await c.req.json().catch(() => null)
  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'Invalid profile payload',
      parsed.error.flatten(),
    )
  }

  const [current] = await db.select().from(users).where(eq(users.id, auth.sub)).limit(1)
  if (!current) {
    return jsonError(c, 401, 'unauthorized', 'User no longer exists')
  }

  const data = parsed.data
  if (
    data.name === undefined &&
    data.email === undefined &&
    data.avatarUrl === undefined
  ) {
    return jsonError(c, 400, 'invalid_body', 'No fields to update')
  }

  const nextName = data.name !== undefined ? data.name.trim() : current.name
  const nextEmail =
    data.email !== undefined ? data.email.trim().toLowerCase() : current.email

  if (!nextName) {
    return jsonError(c, 400, 'invalid_body', 'Name is required')
  }

  if (nextEmail !== current.email) {
    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, nextEmail))
      .limit(1)
    if (dup) {
      return jsonError(c, 409, 'email_taken', 'Email already in use')
    }
  }

  let nextAvatar = current.avatarUrl
  if (data.avatarUrl !== undefined) {
    nextAvatar = data.avatarUrl
  }

  const [user] = await db
    .update(users)
    .set({
      name: nextName,
      email: nextEmail,
      avatarUrl: nextAvatar,
      updatedAt: new Date(),
    })
    .where(eq(users.id, current.id))
    .returning()

  const token = await issueToken(user)
  await writeAudit(c, {
    action: 'auth.profile_update',
    objectType: 'user',
    objectId: user.id,
    summary: `更新个人资料`,
    meta: {
      name: data.name !== undefined,
      email: data.email !== undefined,
      avatar: data.avatarUrl !== undefined,
    },
  })
  return c.json({ user: mapUser(user), token })
})

/** POST /auth/change-password — current user changes password */
authRoutes.post('/change-password', requireAuth, async (c) => {
  const auth = c.get('user')
  const body = await c.req.json().catch(() => null)
  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'invalid_body',
      'currentPassword and newPassword required',
      parsed.error.flatten(),
    )
  }

  const [user] = await db.select().from(users).where(eq(users.id, auth.sub)).limit(1)
  if (!user) {
    return jsonError(c, 401, 'unauthorized', 'User no longer exists')
  }

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!ok) {
    return jsonError(c, 401, 'wrong_password', 'Current password is incorrect')
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return jsonError(c, 400, 'same_as_current', 'New password must differ from current')
  }

  const policy = validatePassword(parsed.data.newPassword)
  if (!policy.ok) {
    return jsonError(c, 400, policy.code, policy.message)
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  await writeAudit(c, {
    action: 'auth.change_password',
    objectType: 'user',
    objectId: user.id,
    summary: `修改登录密码`,
  })

  return c.json({ ok: true })
})
