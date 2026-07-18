/**
 * Authenticated HTTP client for Artifact Center API.
 */

import { getAccessToken, setAccessToken } from '@/services/session'

export type HttpError = {
  status: number
  code: string
  message: string
  details?: unknown
}

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api'

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(err: HttpError) {
    super(err.message)
    this.name = 'ApiError'
    this.status = err.status
    this.code = err.code
    this.details = err.details
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  /** Skip Authorization header */
  public?: boolean
  /** FormData / Blob body — do not JSON-stringify */
  rawBody?: BodyInit | null
}

/** Called on 401 so auth-store can clear session without circular imports */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'http_error'
  let message = res.statusText || `HTTP ${res.status}`
  let details: unknown
  try {
    const data = (await res.json()) as {
      error?: { code?: string; message?: string; details?: unknown }
    }
    if (data?.error) {
      code = data.error.code ?? code
      message = data.error.message ?? message
      details = data.error.details
    }
  } catch {
    // ignore non-JSON
  }
  return new ApiError({ status: res.status, code, message, details })
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, public: isPublic, headers: initHeaders, ...rest } = options
  const headers = new Headers(initHeaders)

  if (!isPublic) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let finalBody: BodyInit | undefined | null = rawBody
  if (body !== undefined && rawBody === undefined) {
    headers.set('Content-Type', 'application/json')
    finalBody = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: finalBody === null ? undefined : finalBody,
  })

  if (res.status === 401 && !isPublic) {
    setAccessToken(null)
    onUnauthorized?.()
  }

  if (!res.ok) {
    throw await parseError(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    return (await res.json()) as T
  }

  return undefined as T
}

export async function requestBlob(
  path: string,
  options: { public?: boolean } = {},
): Promise<{ blob: Blob; filename?: string }> {
  const headers = new Headers()
  if (!options.public) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { headers })

  if (res.status === 401 && !options.public) {
    setAccessToken(null)
    onUnauthorized?.()
  }

  if (!res.ok) {
    throw await parseError(res)
  }

  const disposition = res.headers.get('content-disposition') ?? ''
  const match = /filename="([^"]+)"/i.exec(disposition)
  const filename = match?.[1]
  const blob = await res.blob()
  return { blob, filename }
}
