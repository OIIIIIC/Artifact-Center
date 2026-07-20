import { randomUUID } from 'node:crypto'

import type { Context, MiddlewareHandler } from 'hono'

import { diagnostics, type DiagnosticLog } from '../lib/diagnostics.js'

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

export type ObservabilityLog = DiagnosticLog

type ObservabilityOptions = {
  slowRequestMs: number
  write?: (log: ObservabilityLog) => void
  now?: () => number
  createRequestId?: () => string
}

type RequestContext = Context<{
  Variables: {
    requestId: string
  }
}>

function defaultWrite(log: ObservabilityLog): void {
  diagnostics.record(log)
  const message = JSON.stringify(log)
  if (log.level === 'error') {
    console.error(message)
  } else if (log.level === 'warn') {
    console.warn(message)
  } else {
    console.log(message)
  }
}

function resolveRequestId(c: Context, createRequestId: () => string): string {
  const upstreamRequestId = c.req.header('x-request-id')?.trim()
  if (upstreamRequestId && REQUEST_ID_PATTERN.test(upstreamRequestId)) {
    return upstreamRequestId
  }
  return createRequestId()
}

function safeRequestPath(url: string): string {
  return new URL(url).pathname.replace(/^(\/public\/shares\/)[^/]+/, '$1:token')
}

/**
 * 为每个 HTTP 请求建立关联锚点，并在完成时输出一条结构化耗时日志。
 */
export function createRequestObservability({
  slowRequestMs,
  write = defaultWrite,
  now = performance.now.bind(performance),
  createRequestId = randomUUID,
}: ObservabilityOptions): MiddlewareHandler {
  return async (c, next) => {
    const startedAt = now()
    const requestId = resolveRequestId(c, createRequestId)
    const requestContext = c as RequestContext
    let failed = false

    requestContext.set('requestId', requestId)
    c.header('X-Request-ID', requestId)

    try {
      await next()
    } catch (error) {
      failed = true
      throw error
    } finally {
      const durationMs = Math.max(0, Math.round((now() - startedAt) * 100) / 100)
      const slow = durationMs >= slowRequestMs
      const status = failed ? 500 : c.res.status

      write({
        timestamp: new Date().toISOString(),
        level: status >= 500 ? 'error' : slow ? 'warn' : 'info',
        event: 'http_request',
        service: 'artifact-center-api',
        requestId,
        method: c.req.method,
        // 查询字符串可能含分享令牌等敏感信息，不进入日志。
        path: safeRequestPath(c.req.url),
        status,
        durationMs,
        slow,
        slowRequestMs,
      })
    }
  }
}

/** 记录安全的异常摘要；响应仍由统一错误处理负责。 */
export function logUnhandledError(c: Context, error: unknown): void {
  const requestId = (c as RequestContext).get('requestId') ?? 'unavailable'
  const normalized = error instanceof Error ? error : new Error(String(error))

  defaultWrite({
    timestamp: new Date().toISOString(),
    level: 'error',
    event: 'unhandled_error',
    service: 'artifact-center-api',
    requestId,
    method: c.req.method,
    path: safeRequestPath(c.req.url),
    error: {
      name: normalized.name,
      message: normalized.message,
      ...(normalized.stack ? { stack: normalized.stack } : {}),
    },
  })
}
