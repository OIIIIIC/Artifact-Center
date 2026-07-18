import { eq } from 'drizzle-orm'

import { env } from '../env.js'
import { hashPassword } from '../lib/password.js'
import { db } from './client.js'
import { users } from './schema.js'

async function main() {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, env.seedEmail))
    .limit(1)

  if (existing[0]) {
    console.log('Seed user already exists:', env.seedEmail)
    process.exit(0)
  }

  const passwordHash = await hashPassword(env.seedPassword)
  const [user] = await db
    .insert(users)
    .values({
      username: 'demo',
      email: env.seedEmail,
      name: env.seedName,
      passwordHash,
      role: 'admin',
    })
    .returning()

  console.log('Seeded admin user:', user.email, '/', env.seedPassword)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
