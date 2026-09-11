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

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

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
  if (error.code === 'request_aborted') return null
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
  /** 普通 API 请求超时；设为 0 可关闭，上传请求不使用此选项。 */
  timeoutMs?: number
}

export interface UploadProgressEvent {
  progress: number
  loadedBytes: number
  totalBytes: number
}

export type UploadProgress = (event: UploadProgressEvent) => void

/** Called on 401 so auth-store can clear session without circular imports */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

function handleUnauthorized(token: string | null) {
  // A response from a previous login must not clear the current session.
  if (!token || token !== getAccessToken()) return
  setAccessToken(null)
  onUnauthorized?.()
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
  } catch (cause) {
    const abortName =
      cause instanceof DOMException || cause instanceof Error ? cause.name : ''
    if (abortName === 'AbortError') {
      throw new ApiError({
        status: 0,
        code: 'request_aborted',
        message: 'Request was cancelled',
      })
    }
    if (abortName === 'TimeoutError') {
      const error = new ApiError({
        status: 0,
        code: 'request_timeout',
        message: 'Request timed out',
      })
      updateConnectivityStatus(getConnectivityStatusForError(error))
      throw error
    }
    const error = new ApiError({
      status: 0,
      code: 'network_error',
      message: 'Network request failed',
    })
    updateConnectivityStatus(getConnectivityStatusForError(error))
    throw error
  }
}

function withTimeout(signal: AbortSignal | null | undefined, timeoutMs: number) {
  if (timeoutMs <= 0) return signal ?? undefined
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    body,
    rawBody,
    public: isPublic,
    headers: initHeaders,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    signal,
    ...rest
  } = options
  const headers = new Headers(initHeaders)
  const token = isPublic ? null : getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let finalBody: BodyInit | undefined | null = rawBody
  if (body !== undefined && rawBody === undefined) {
    headers.set('Content-Type', 'application/json')
    finalBody = JSON.stringify(body)
  }

  const res = await fetchApi(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: finalBody === null ? undefined : finalBody,
    signal: withTimeout(signal, timeoutMs),
  })

  if (res.status === 401 && !isPublic) {
    handleUnauthorized(token)
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
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false

    const abortRequest = () => xhr.abort()
    const cleanup = () => signal?.removeEventListener('abort', abortRequest)
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }

    xhr.open('POST', `${API_BASE_URL}${path}`)

    const token = getAccessToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.({
          progress: Math.round((event.loaded / event.total) * 100),
          loadedBytes: event.loaded,
          totalBytes: event.total,
        })
      }
    }

    xhr.onerror = () => {
      const error = new ApiError({
        status: 0,
        code: 'network_error',
        message: 'Network request failed',
      })
      updateConnectivityStatus(getConnectivityStatusForError(error))
      finish(() => reject(error))
    }

    xhr.onabort = () => {
      finish(() =>
        reject(
          new ApiError({
            status: 0,
            code: 'request_aborted',
            message: 'Request was cancelled',
          }),
        ),
      )
    }

    xhr.onload = () => {
      updateConnectivityStatus(null)
      if (xhr.status === 401) {
        handleUnauthorized(token)
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
        finish(() =>
          reject(
            new ApiError({
              status: xhr.status,
              code: data.error?.code ?? 'http_error',
              message: data.error?.message ?? `HTTP ${xhr.status}`,
              details: data.error?.details,
              requestId: xhr.getResponseHeader('x-request-id') ?? undefined,
            }),
          ),
        )
        return
      }

      if (!data.artifact) {
        finish(() =>
          reject(
            new ApiError({
              status: xhr.status,
              code: 'invalid_response',
              message: 'Expected a JSON response body',
              requestId: xhr.getResponseHeader('x-request-id') ?? undefined,
            }),
          ),
        )
        return
      }
      finish(() => resolve(data.artifact as T))
    }

    if (signal?.aborted) {
      finish(() =>
        reject(
          new ApiError({
            status: 0,
            code: 'request_aborted',
            message: 'Request was cancelled',
          }),
        ),
      )
      return
    }

    signal?.addEventListener('abort', abortRequest, { once: true })
    xhr.send(body)
  })
}

/** Upload one resumable binary chunk and report its individual wire progress. */
export async function requestUploadPart(
  path: string,
  body: Blob,
  onProgress?: UploadProgress,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false
    const abortRequest = () => xhr.abort()
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abortRequest)
      callback()
    }

    xhr.open('PUT', `${API_BASE_URL}${path}`)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    const token = getAccessToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.({
        progress: Math.round((event.loaded / event.total) * 100),
        loadedBytes: event.loaded,
        totalBytes: event.total,
      })
    }
    xhr.onerror = () =>
      finish(() =>
        reject(
          new ApiError({
            status: 0,
            code: 'network_error',
            message: 'Network request failed',
          }),
        ),
      )
    xhr.onabort = () =>
      finish(() =>
        reject(
          new ApiError({
            status: 0,
            code: 'request_aborted',
            message: 'Request was cancelled',
          }),
        ),
      )
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finish(resolve)
        return
      }
      let data: { error?: { code?: string; message?: string; details?: unknown } } = {}
      try {
        data = JSON.parse(xhr.responseText) as typeof data
      } catch {
        // Use HTTP fallback below.
      }
      finish(() =>
        reject(
          new ApiError({
            status: xhr.status,
            code: data.error?.code ?? 'http_error',
            message: data.error?.message ?? `HTTP ${xhr.status}`,
            details: data.error?.details,
            requestId: xhr.getResponseHeader('x-request-id') ?? undefined,
          }),
        ),
      )
    }
    if (signal?.aborted) {
      finish(() =>
        reject(
          new ApiError({
            status: 0,
            code: 'request_aborted',
            message: 'Request was cancelled',
          }),
        ),
      )
      return
    }
    signal?.addEventListener('abort', abortRequest, { once: true })
    xhr.send(body)
  })
}

/** Upload to a short-lived object-store URL. The ETag is needed to complete S3 multipart upload. */
export async function requestExternalUploadPart(
  url: string,
  body: Blob,
  onProgress?: UploadProgress,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false
    const abortRequest = () => xhr.abort()
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abortRequest)
      callback()
    }
    xhr.open('PUT', url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.({
          progress: Math.round((event.loaded / event.total) * 100),
          loadedBytes: event.loaded,
          totalBytes: event.total,
        })
      }
    }
    xhr.onerror = () =>
      finish(() =>
        reject(
          new ApiError({
            status: 0,
            code: 'network_error',
            message: 'Network request failed',
          }),
        ),
      )
    xhr.onabort = () =>
      finish(() =>
        reject(
          new ApiError({
            status: 0,
            code: 'request_aborted',
            message: 'Request was cancelled',
          }),
        ),
      )
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('etag')
        if (etag) return finish(() => resolve(etag))
      }
      finish(() =>
        reject(
          new ApiError({
            status: xhr.status,
            code: 'object_upload_failed',
            message: 'Object storage upload failed',
          }),
        ),
      )
    }
    if (signal?.aborted)
      return finish(() =>
        reject(
          new ApiError({
            status: 0,
            code: 'request_aborted',
            message: 'Request was cancelled',
          }),
        ),
      )
    signal?.addEventListener('abort', abortRequest, { once: true })
    xhr.send(body)
  })
}

export async function requestBlob(
  path: string,
  options: { public?: boolean; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<{ blob: Blob; filename?: string }> {
  const headers = new Headers()
  const token = options.public ? null : getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetchApi(`${API_BASE_URL}${path}`, {
    headers,
    signal: withTimeout(options.signal, options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
  })

  if (res.status === 401 && !options.public) {
    handleUnauthorized(token)
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
