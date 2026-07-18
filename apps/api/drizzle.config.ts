import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://artifact:artifact@localhost:5432/artifact_center',
  },
})
