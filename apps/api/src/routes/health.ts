import { constants } from 'node:fs'
import { access } from 'node:fs/promises'

import { sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '../db/client.js'
import { env } from '../env.js'

interface HealthDependencies {
  checkDatabase: () => Promise<void>
  checkStorage: () => Promise<void>
  now: () => Date
  storagePath: string
}

const defaultDependencies: HealthDependencies = {
  checkDatabase: async () => {
    await db.execute(sql`select 1`)
  },
  checkStorage: async () => {
    await access(env.storagePath, constants.R_OK | constants.W_OK)
  },
  now: () => new Date(),
  storagePath: env.storagePath,
}

function liveness(dependencies: HealthDependencies) {
  return {
    ok: true,
    service: 'artifact-center-api',
    time: dependencies.now().toISOString(),
    // 兼容既有诊断调用；后续版本可迁移到管理员诊断接口。
    storage: dependencies.storagePath,
  }
}

export function createHealthRoutes(
  dependencies: HealthDependencies = defaultDependencies,
) {
  const routes = new Hono()

  routes.get('/health', (c) => c.json(liveness(dependencies)))
  routes.get('/health/live', (c) => c.json(liveness(dependencies)))
  routes.get('/health/ready', async (c) => {
    const [database, storage] = await Promise.allSettled([
      dependencies.checkDatabase(),
      dependencies.checkStorage(),
    ])
    const checks = {
      database: database.status === 'fulfilled' ? 'ok' : 'unavailable',
      storage: storage.status === 'fulfilled' ? 'ok' : 'unavailable',
    } as const
    const ready = database.status === 'fulfilled' && storage.status === 'fulfilled'

    return c.json(
      {
        ok: ready,
        service: 'artifact-center-api',
        time: dependencies.now().toISOString(),
        checks,
      },
      ready ? 200 : 503,
    )
  })

  return routes
}

export const healthRoutes = createHealthRoutes()
