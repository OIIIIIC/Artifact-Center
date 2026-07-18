import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

import { env } from '../env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const sql = postgres(env.databaseUrl, { max: 1 })
  const db = drizzle(sql)
  const migrationsFolder = path.resolve(__dirname, '../../drizzle')
  console.log('Migrating…', migrationsFolder)
  await migrate(db, { migrationsFolder })
  await sql.end()
  console.log('Migrations done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
