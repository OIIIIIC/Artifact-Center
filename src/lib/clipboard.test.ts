import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyText } from './clipboard'

describe('复制文本', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('优先使用 Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    await expect(copyText('http://10.110.200.233:18080/d/token')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('http://10.110.200.233:18080/d/token')
  })

  it('Clipboard API 不可用时退回到选区复制', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    })

    await expect(copyText('http://10.110.200.233:18080/d/token')).resolves.toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).not.toBeInTheDocument()
  })

  it('Clipboard API 被浏览器拒绝时退回到选区复制', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Not allowed'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    })

    await expect(copyText('# 诊断报告')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('# 诊断报告')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })
})
