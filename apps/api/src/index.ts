import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { env } from './env.js'
import { ensureRetentionSettings, runRetentionCleanup } from './lib/retention.js'
import { revokeExpiredShares } from './lib/share-expiration.js'
import { ensureStorageRoot } from './lib/storage.js'
import {
  createRequestObservability,
  logUnhandledError,
} from './middleware/observability.js'
import { applicationRoutes } from './routes/applications.js'
import { artifactRoutes } from './routes/artifacts.js'
import { auditRoutes } from './routes/audit.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { publicRoutes } from './routes/public.js'
import { releaseCredentialRoutes } from './routes/release-credentials.js'
import { releaseArtifactRoutes } from './routes/release-artifacts.js'
import { searchRoutes } from './routes/search.js'
import { settingsRoutes } from './routes/settings.js'
import { shareRoutes } from './routes/shares.js'
import { userRoutes } from './routes/users.js'
import { workspaceRoutes } from './routes/workspace.js'
import { uploadRoutes } from './routes/uploads.js'

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

// Capability links are revoked promptly when their selected validity period ends.
const SHARE_EXPIRATION_INTERVAL_MS = 60 * 1000
function runShareExpirationCleanup() {
  void revokeExpiredShares()
    .then((result) => {
      if (result.revoked > 0) {
        console.log('[shares] expired links revoked', result)
      }
    })
    .catch((err) => console.error('[shares] expiration cleanup failed', err))
}
runShareExpirationCleanup()
setInterval(runShareExpirationCleanup, SHARE_EXPIRATION_INTERVAL_MS)

const app = new Hono()

app.use('*', createRequestObservability({ slowRequestMs: env.slowRequestMs }))
app.use(
  '*',
  cors({
    origin: env.corsOrigin,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Disposition', 'Content-Length', 'X-Request-ID'],
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
// Upload routes include /applications/:appId/uploads and must be registered before
// the ordinary /applications tree so its user-only middleware cannot intercept robots.
app.route('/', uploadRoutes)
app.route('/applications', applicationRoutes)
app.route('/workspace', workspaceRoutes)
app.route('/settings/release-credentials', releaseCredentialRoutes)
app.route('/release', releaseArtifactRoutes)
app.route('/', shareRoutes)
app.route('/', artifactRoutes)

app.notFound((c) =>
  c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404),
)

app.onError((err, c) => {
  logUnhandledError(c, err)
  return c.json(
    { error: { code: 'internal_error', message: '服务器处理请求时发生错误' } },
    500,
  )
})

console.log(`Artifact Center API → http://localhost:${env.port}`)
console.log(`  storage: ${env.storagePath}`)
console.log(`  cors:    ${env.corsOrigin}`)

const server = serve({
  fetch: app.fetch,
  hostname: env.host,
  port: env.port,
})

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`[server] received ${signal}, shutting down`)
    server.close(() => process.exit(0))
  })
}
