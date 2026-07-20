import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, request } from '@/services/http'

describe('HTTP 错误关联', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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
})
