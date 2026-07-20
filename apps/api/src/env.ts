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

export const env = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required(
    'DATABASE_URL',
    'postgres://artifact:artifact@localhost:5432/artifact_center',
  ),
  jwtSecret: required('JWT_SECRET', 'dev-change-me-artifact-center-jwt-secret'),
  storagePath: path.resolve(
    process.cwd(),
    process.env.STORAGE_PATH ?? '../../data/files',
  ),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  slowRequestMs: positiveNumber('SLOW_REQUEST_MS', 500),
  /** Seed demo user (matches frontend mock) */
  seedEmail: 'demo@enterprise.local',
  seedPassword: 'Demo@2026',
  seedName: 'Demo User',
}
