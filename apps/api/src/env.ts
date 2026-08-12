import 'dotenv/config'
import path from 'node:path'

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function positiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid positive number in env ${name}`)
  }
  return value
}

function booleanValue(name: string, fallback: boolean): boolean {
  const value = process.env[name]
  if (value === undefined) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`Invalid boolean value in env ${name}`)
}

const production = process.env.NODE_ENV === 'production'
const databaseUrl = required(
  'DATABASE_URL',
  'postgres://artifact:artifact@localhost:5432/artifact_center',
)
const jwtSecret = required('JWT_SECRET', 'dev-change-me-artifact-center-jwt-secret')
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
const objectStorageEndpoint = process.env.OBJECT_STORAGE_ENDPOINT
const objectStoragePublicEndpoint = process.env.OBJECT_STORAGE_PUBLIC_ENDPOINT
const objectStorageBucket = process.env.OBJECT_STORAGE_BUCKET
const objectStorageAccessKey = process.env.OBJECT_STORAGE_ACCESS_KEY
const objectStorageSecretKey = process.env.OBJECT_STORAGE_SECRET_KEY
const objectStorageConfigured = [
  objectStorageEndpoint,
  objectStoragePublicEndpoint,
  objectStorageBucket,
  objectStorageAccessKey,
  objectStorageSecretKey,
].some(Boolean)

if (
  objectStorageConfigured &&
  ![
    objectStorageEndpoint,
    objectStoragePublicEndpoint,
    objectStorageBucket,
    objectStorageAccessKey,
    objectStorageSecretKey,
  ].every(Boolean)
) {
  throw new Error(
    'Object storage requires endpoint, public endpoint, bucket and access keys',
  )
}

if (production && !process.env.DATABASE_URL) {
  throw new Error('Missing env DATABASE_URL in production')
}
if (production && (!process.env.JWT_SECRET || jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production')
}
if (production && corsOrigin === '*') {
  throw new Error('CORS_ORIGIN must not be * in production')
}

/** 分享链接 pepper：生产必须独立配置；开发可回落到 JWT_SECRET。 */
const shareTokenPepper = process.env.SHARE_TOKEN_PEPPER ?? (production ? '' : jwtSecret)

if (production && shareTokenPepper.length < 32) {
  throw new Error('SHARE_TOKEN_PEPPER must contain at least 32 characters in production')
}

export const env = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3001),
  databaseUrl,
  jwtSecret,
  shareTokenPepper,
  storagePath: path.resolve(
    process.cwd(),
    process.env.STORAGE_PATH ?? '../../data/files',
  ),
  /** Optional S3-compatible storage (MinIO / AWS S3) for browser-direct multipart upload. */
  objectStorage: objectStorageConfigured
    ? {
        endpoint: objectStorageEndpoint!,
        publicEndpoint: objectStoragePublicEndpoint!,
        bucket: objectStorageBucket!,
        accessKey: objectStorageAccessKey!,
        secretKey: objectStorageSecretKey!,
        region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
      }
    : null,
  corsOrigin,
  slowRequestMs: positiveNumber('SLOW_REQUEST_MS', 500),
  /** 仅在前置代理会覆盖 X-Real-IP 时启用，防止客户端伪造转发头绕过限流。 */
  trustProxy: booleanValue('TRUST_PROXY', false),
  rateLimitWindowSeconds: positiveNumber('RATE_LIMIT_WINDOW_SECONDS', 60),
  loginRateLimitMaxAttempts: positiveNumber('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 10),
  publicRateLimitMaxRequests: positiveNumber('PUBLIC_RATE_LIMIT_MAX_REQUESTS', 120),
  /** 上传后仍必须保留的最小可用磁盘空间，防止写满宿主机。 */
  storageMinFreeBytes: positiveNumber('STORAGE_MIN_FREE_BYTES', 512 * 1024 * 1024),
  /** 本地开发环境的初始化管理员 */
  seedUsername: 'oiiic',
  seedEmail: 'oiiic@enterprise.local',
  seedPassword: '***REMOVED***',
  seedName: 'oiiic',
}
