import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiError,
  getConnectivityStatusForError,
  request,
  requestMultipart,
} from '@/services/http'

describe('HTTP 错误关联', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('在服务器错误中保留并展示请求 ID', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'internal_error', message: '服务器处理请求时发生错误' },
        }),
        {
          status: 500,
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'request-for-support',
          },
        },
      ),
    )

    try {
      await request('/broken', { public: true })
      throw new Error('预期请求失败')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ requestId: 'request-for-support' })
      expect((error as Error).message).toContain('请求 ID：request-for-support')
    }
  })

  it('普通业务错误不在提示中追加请求 ID', () => {
    const error = new ApiError({
      status: 400,
      code: 'invalid_body',
      message: '请求参数不正确',
      requestId: 'request-not-shown',
    })

    expect(error.requestId).toBe('request-not-shown')
    expect(error.message).toBe('请求参数不正确')
  })

  it.each([
    ['AbortError', 'request_aborted'],
    ['TimeoutError', 'request_timeout'],
  ])('区分 %s 请求异常', async (name, code) => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('请求未完成', name))

    await expect(request('/slow', { public: true })).rejects.toMatchObject({
      status: 0,
      code,
    })
  })

  it('用户主动取消不触发离线或服务不可用提示', () => {
    const error = new ApiError({
      status: 0,
      code: 'request_aborted',
      message: 'Request was cancelled',
    })

    expect(getConnectivityStatusForError(error)).toBeNull()
  })

  it('为普通请求附加超时信号，同时允许显式关闭超时', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
        }),
    )

    await request('/with-timeout', { public: true })
    await request('/without-timeout', { public: true, timeoutMs: 0 })

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBeUndefined()
  })

  it('取消上传时中止 XHR 并返回 request_aborted', async () => {
    class FakeXMLHttpRequest {
      static latest: FakeXMLHttpRequest | null = null

      upload = { onprogress: null as ((event: ProgressEvent) => void) | null }
      onerror: (() => void) | null = null
      onabort: (() => void) | null = null
      onload: (() => void) | null = null
      status = 0
      responseText = ''

      constructor() {
        FakeXMLHttpRequest.latest = this
      }

      open() {}
      setRequestHeader() {}
      getResponseHeader() {
        return null
      }
      send() {}
      abort() {
        this.onabort?.()
      }
    }

    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
    const controller = new AbortController()
    const upload = requestMultipart(
      '/applications/app-1/artifacts',
      new FormData(),
      undefined,
      controller.signal,
    )

    controller.abort()

    await expect(upload).rejects.toMatchObject({
      status: 0,
      code: 'request_aborted',
    })
    expect(FakeXMLHttpRequest.latest).not.toBeNull()
  })
})
