/**
 * Authenticated HTTP client for Artifact Center API.
 */

import { getAccessToken, setAccessToken } from '@/services/session'

export type HttpError = {
  status: number
  code: string
  message: string
  details?: unknown
  requestId?: string
}

export type ConnectivityStatus = 'offline' | 'unavailable' | null

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api'

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown
  requestId?: string

  constructor(err: HttpError) {
    const supportSuffix =
      err.status >= 500 && err.requestId ? `（请求 ID：${err.requestId}）` : ''
    super(`${err.message}${supportSuffix}`)
    this.name = 'ApiError'
    this.status = err.status
    this.code = err.code
    this.details = err.details
    this.requestId = err.requestId
  }
}

let connectivityStatus: ConnectivityStatus = null
const connectivityListeners = new Set<() => void>()

function updateConnectivityStatus(next: ConnectivityStatus) {
  if (connectivityStatus === next) return
  connectivityStatus = next
  connectivityListeners.forEach((listener) => listener())
}

export function getConnectivityStatus() {
  return connectivityStatus
}

export function subscribeConnectivityStatus(listener: () => void) {
  connectivityListeners.add(listener)
  return () => connectivityListeners.delete(listener)
}

export function setConnectivityStatus(next: ConnectivityStatus) {
  updateConnectivityStatus(next)
}

export function getConnectivityStatusForError(error: unknown): ConnectivityStatus {
  if (!(error instanceof ApiError)) return null
  if (error.status >= 500) return 'unavailable'
  if (error.status !== 0) return null
  return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'unavailable'
}

export function isConnectivityError(error: unknown) {
  return getConnectivityStatusForError(error) !== null
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  /** Skip Authorization header */
  public?: boolean
  /** FormData / Blob body — do not JSON-stringify */
  rawBody?: BodyInit | null
}

export type UploadProgress = (progress: number) => void

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
  return new ApiError({
    status: res.status,
    code,
    message,
    details,
    requestId: res.headers.get('x-request-id') ?? undefined,
  })
}

async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, init)
    updateConnectivityStatus(null)
    return response
  } catch {
    const error = new ApiError({
      status: 0,
      code: 'network_error',
      message: 'Network request failed',
    })
    updateConnectivityStatus(getConnectivityStatusForError(error))
    throw error
  }
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

  const res = await fetchApi(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: finalBody === null ? undefined : finalBody,
  })

  if (res.status === 401 && !isPublic) {
    setAccessToken(null)
    onUnauthorized?.()
  }

  if (!res.ok) {
    const error = await parseError(res)
    updateConnectivityStatus(getConnectivityStatusForError(error))
    throw error
  }

  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    return (await res.json()) as T
  }

  throw new ApiError({
    status: res.status,
    code: 'invalid_response',
    message: 'Expected a JSON response body',
    requestId: res.headers.get('x-request-id') ?? undefined,
  })
}

/** 使用原生 XHR 获取上传进度；请求生命周期由调用方的全局管理器持有。 */
export async function requestMultipart<T>(
  path: string,
  body: FormData,
  onProgress?: UploadProgress,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}${path}`)

    const token = getAccessToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onerror = () => {
      reject(
        new ApiError({
          status: 0,
          code: 'network_error',
          message: 'Network request failed',
        }),
      )
    }

    xhr.onload = () => {
      if (xhr.status === 401) {
        setAccessToken(null)
        onUnauthorized?.()
      }

      let data: {
        artifact?: T
        error?: { code?: string; message?: string; details?: unknown }
      }
      try {
        data = JSON.parse(xhr.responseText) as typeof data
      } catch {
        data = {}
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new ApiError({
            status: xhr.status,
            code: data.error?.code ?? 'http_error',
            message: data.error?.message ?? `HTTP ${xhr.status}`,
            details: data.error?.details,
            requestId: xhr.getResponseHeader('x-request-id') ?? undefined,
          }),
        )
        return
      }

      if (!data.artifact) {
        reject(
          new ApiError({
            status: xhr.status,
            code: 'invalid_response',
            message: 'Expected a JSON response body',
            requestId: xhr.getResponseHeader('x-request-id') ?? undefined,
          }),
        )
        return
      }
      resolve(data.artifact)
    }

    xhr.send(body)
  })
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

  const res = await fetchApi(`${API_BASE_URL}${path}`, { headers })

  if (res.status === 401 && !options.public) {
    setAccessToken(null)
    onUnauthorized?.()
  }

  if (!res.ok) {
    const error = await parseError(res)
    updateConnectivityStatus(getConnectivityStatusForError(error))
    throw error
  }

  const disposition = res.headers.get('content-disposition') ?? ''
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  const fallbackMatch = /filename="([^"]+)"/i.exec(disposition)
  let filename = fallbackMatch?.[1]
  if (encodedMatch?.[1]) {
    try {
      filename = decodeURIComponent(encodedMatch[1])
    } catch {
      // 编码异常时使用 ASCII 兼容文件名。
    }
  }
  const blob = await res.blob()
  return { blob, filename }
}
