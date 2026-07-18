import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { env } from './env.js'
import { ensureRetentionSettings, runRetentionCleanup } from './lib/retention.js'
import { ensureStorageRoot } from './lib/storage.js'
import { applicationRoutes } from './routes/applications.js'
import { artifactRoutes } from './routes/artifacts.js'
import { auditRoutes } from './routes/audit.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { publicRoutes } from './routes/public.js'
import { searchRoutes } from './routes/search.js'
import { settingsRoutes } from './routes/settings.js'
import { shareRoutes } from './routes/shares.js'
import { userRoutes } from './routes/users.js'

ensureStorageRoot()
void ensureRetentionSettings().catch((err) =>
  console.error('[retention] seed settings failed', err),
)

// Periodic soft cleanup (max versions + archive deprecated)
const RETENTION_INTERVAL_MS = 60 * 60 * 1000
setInterval(() => {
  void runRetentionCleanup()
    .then((r) => {
      if (r.deletedVersions || r.archivedDeprecated) {
        console.log('[retention] cleanup', r)
      }
    })
    .catch((err) => console.error('[retention] cleanup failed', err))
}, RETENTION_INTERVAL_MS)

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: env.corsOrigin,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Disposition', 'Content-Length'],
  }),
)

app.route('/', healthRoutes)
app.route('/auth', authRoutes)
// Public share routes before authenticated trees
app.route('/public', publicRoutes)
app.route('/users', userRoutes)
app.route('/audit', auditRoutes)
app.route('/search', searchRoutes)
app.route('/settings', settingsRoutes)
app.route('/applications', applicationRoutes)
app.route('/', shareRoutes)
app.route('/', artifactRoutes)

app.notFound((c) =>
  c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404),
)

app.onError((err, c) => {
  console.error(err)
  return c.json(
    { error: { code: 'internal_error', message: 'Internal server error' } },
    500,
  )
})

console.log(`Artifact Center API → http://localhost:${env.port}`)
console.log(`  storage: ${env.storagePath}`)
console.log(`  cors:    ${env.corsOrigin}`)

serve({
  fetch: app.fetch,
  port: env.port,
})
