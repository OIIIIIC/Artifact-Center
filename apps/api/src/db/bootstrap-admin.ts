import { eq } from 'drizzle-orm'

import { db } from './client.js'
import { users } from './schema.js'
import { hashPassword } from '../lib/password.js'
import { validatePassword } from '../lib/password-policy.js'

async function main() {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1)

  if (admin) {
    console.log('Bootstrap admin skipped: an administrator already exists.')
    process.exit(0)
  }

  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim()
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD

  if (!name || !email || !password) {
    throw new Error(
      'No administrator exists. Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.',
    )
  }

  const passwordCheck = validatePassword(password)
  if (!passwordCheck.ok) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD is invalid: ${passwordCheck.message}`)
  }

  const [sameEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (sameEmail) {
    throw new Error(`BOOTSTRAP_ADMIN_EMAIL already belongs to a non-admin user: ${email}`)
  }

  await db.insert(users).values({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
  })

  console.log(`Bootstrap administrator created: ${email}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
