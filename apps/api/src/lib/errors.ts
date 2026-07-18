import type { Context } from 'hono'

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function jsonError(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  }
  return c.json(body, status as 400)
}
