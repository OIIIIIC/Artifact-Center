import { describe, expect, it } from 'vitest'

import { attachmentDisposition } from '../lib/download-response.js'

describe('下载文件名响应头', () => {
  it('同时生成 ASCII 回退和 UTF-8 文件名', () => {
    const header = attachmentDisposition('移动银行-1.0.0.apk')

    expect(header).toContain('attachment; filename="')
    expect(header).toContain("filename*=UTF-8''")
    expect(header).toContain('%E7%A7%BB%E5%8A%A8')
  })

  it('移除 ASCII 回退文件名中的响应头注入字符', () => {
    const header = attachmentDisposition('artifact"\r\nX-Evil: yes.apk')
    const fallback = /filename="([^"]+)"/.exec(header)?.[1] ?? ''

    expect(fallback).not.toMatch(/[\r\n"\\]/)
    expect(header).not.toContain('\r\n')
  })
})
