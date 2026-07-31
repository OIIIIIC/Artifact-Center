import { afterEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

async function loadProductionEnv(overrides: Record<string, string | undefined>) {
  process.env.NODE_ENV = 'production'
  process.env.DATABASE_URL = 'postgres://artifact:secret@db/artifact_center'
  process.env.JWT_SECRET = 'x'.repeat(32)
  process.env.CORS_ORIGIN = 'https://artifacts.example.internal'
  process.env.SHARE_TOKEN_PEPPER = 'p'.repeat(32)
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.resetModules()
  return import('../env.js')
}

describe('生产环境配置', () => {
  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('接受显式且安全的生产配置', async () => {
    const { env } = await loadProductionEnv({
      SHARE_TOKEN_PEPPER: 'p'.repeat(32),
    })

    expect(env.databaseUrl).toContain('artifact_center')
    expect(env.jwtSecret).toHaveLength(32)
    expect(env.shareTokenPepper).toHaveLength(32)
  })

  it('拒绝空数据库地址', async () => {
    await expect(loadProductionEnv({ DATABASE_URL: '' })).rejects.toThrow(
      'Missing env DATABASE_URL',
    )
  })

  it('拒绝过短 JWT 密钥', async () => {
    await expect(loadProductionEnv({ JWT_SECRET: 'short-secret' })).rejects.toThrow(
      'at least 32 characters',
    )
  })

  it('拒绝生产环境开放任意 CORS 来源', async () => {
    await expect(loadProductionEnv({ CORS_ORIGIN: '*' })).rejects.toThrow('must not be *')
  })

  it('拒绝过短分享令牌 pepper', async () => {
    await expect(loadProductionEnv({ SHARE_TOKEN_PEPPER: 'too-short' })).rejects.toThrow(
      'SHARE_TOKEN_PEPPER',
    )
  })
})
