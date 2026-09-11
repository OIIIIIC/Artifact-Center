import { afterEach, describe, expect, it, vi } from 'vitest'
import { request, requestBlob, requestMultipart, setUnauthorizedHandler } from './http'
import { getAccessToken, setAccessToken } from './session'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  setAccessToken(null)
  setUnauthorizedHandler(() => {})
})

describe('旧会话的迟到 401 响应', () => {
  it('上传返回旧会话 401 也不能登出新账号', async () => {
    class FakeXHR {
      static latest: FakeXHR
      upload = {}
      status = 401
      responseText = '{}'
      onload?: () => void
      constructor() {
        FakeXHR.latest = this
      }
      open() {}
      send() {}
      setRequestHeader() {}
      getResponseHeader() {
        return null
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)
    const unauthorized = vi.fn()
    setUnauthorizedHandler(unauthorized)
    setAccessToken('account-A')
    const pending = requestMultipart('/upload', new FormData())
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 })
    setAccessToken('account-B')
    FakeXHR.latest.onload?.()
    await rejected
    expect(getAccessToken()).toBe('account-B')
    expect(unauthorized).not.toHaveBeenCalled()
  })
  it.each([
    ['JSON', request],
    ['Blob', requestBlob],
  ] as const)('%s 请求失败不能登出后来登录的账号', async (_, load) => {
    let finish!: (response: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const unauthorized = vi.fn()
    setUnauthorizedHandler(unauthorized)
    setAccessToken('account-A')
    const pending = load('/old-session-request')
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 })
    setAccessToken('account-B')
    finish(new Response('{}', { status: 401 }))
    await rejected
    expect(getAccessToken()).toBe('account-B')
    expect(unauthorized).not.toHaveBeenCalled()
  })
  it('当前会话的 401 仍正常退出登录', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }))
    const unauthorized = vi.fn()
    setUnauthorizedHandler(unauthorized)
    setAccessToken('current-account')
    await expect(request('/expired')).rejects.toMatchObject({ status: 401 })
    expect(getAccessToken()).toBeNull()
    expect(unauthorized).toHaveBeenCalledOnce()
  })
})
