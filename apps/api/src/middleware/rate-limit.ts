import type { Context } from 'hono'

import { jsonError } from '../lib/errors.js'

type RateLimitBucket = {
  count: number
  resetAtMs: number
}

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number }

type FixedWindowRateLimiterOptions = {
  maxRequests: number
  windowMs: number
  maxEntries?: number
  now?: () => number
}

/**
 * 进程内固定窗口限流。它不是多实例共享配额，适合作为 API 的第一道防线；
 * 达到条目上限时，新键共用溢出桶，避免随机 token 让内存无限增长。
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>()
  private readonly now: () => number
  private readonly maxEntries: number

  constructor(private readonly options: FixedWindowRateLimiterOptions) {
    this.now = options.now ?? Date.now
    this.maxEntries = options.maxEntries ?? 10_000
  }

  check(key: string): RateLimitResult {
    const now = this.now()
    const existing = this.buckets.get(key)
    const bucketKey =
      existing || this.buckets.size < this.maxEntries ? key : '__rate_limit_overflow__'
    const current = this.buckets.get(bucketKey)

    if (!current || now >= current.resetAtMs) {
      this.buckets.set(bucketKey, {
        count: 1,
        resetAtMs: now + this.options.windowMs,
      })
      this.prune(now)
      return { allowed: true }
    }

    if (current.count >= this.options.maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAtMs - now) / 1000)),
      }
    }

    current.count += 1
    return { allowed: true }
  }

  private prune(now: number) {
    if (this.buckets.size <= this.maxEntries) return
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAtMs) this.buckets.delete(key)
    }
  }
}

type IncomingRequest = {
  socket?: { remoteAddress?: string | undefined }
}

/**
 * 可信反向代理会覆盖 X-Real-IP；X-Forwarded-For 可由客户端预先伪造，不能用于限流键。
 * 未启用可信代理时优先读取 Node 直连 socket，无法取得时退化为一个共享桶。
 */
export function resolveClientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const realIp = c.req.header('x-real-ip')?.trim()
    if (realIp) return realIp.slice(0, 64)
  }

  const incoming = (c.env as { incoming?: IncomingRequest } | undefined)?.incoming
  const remoteAddress = incoming?.socket?.remoteAddress?.trim()
  return remoteAddress ? remoteAddress.slice(0, 64) : 'unknown'
}

export function enforceRateLimit(
  c: Context,
  limiter: FixedWindowRateLimiter,
  key: string,
): Response | undefined {
  const result = limiter.check(key)
  if (result.allowed) return undefined

  c.header('Retry-After', String(result.retryAfterSeconds))
  return jsonError(c, 429, 'rate_limited', 'Too many requests; retry later', {
    retryAfterSeconds: result.retryAfterSeconds,
  })
}
