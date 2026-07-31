import { describe, expect, it } from 'vitest'

import {
  createShareToken,
  hashShareToken,
  shareTokenHashesEqual,
  shareTokenPrefix,
} from '../lib/share-token.js'

describe('share-token', () => {
  it('生成足够长的不可猜测令牌', () => {
    const token = createShareToken()
    expect(token.length).toBeGreaterThanOrEqual(32)
    expect(createShareToken()).not.toBe(token)
  })

  it('相同明文产生稳定 HMAC 摘要，且摘要不等于明文', () => {
    const token = createShareToken()
    const hash = hashShareToken(token)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toBe(token)
    expect(hashShareToken(token)).toBe(hash)
  })

  it('固定时间比较可区分匹配与不匹配摘要', () => {
    const token = createShareToken()
    const hash = hashShareToken(token)
    expect(shareTokenHashesEqual(hash, hashShareToken(token))).toBe(true)
    expect(shareTokenHashesEqual(hash, hashShareToken(`${token}x`))).toBe(false)
    expect(shareTokenHashesEqual(hash, 'not-hex')).toBe(false)
  })

  it('前缀仅用于展示', () => {
    expect(shareTokenPrefix('abcdefghijklmnop')).toBe('abcdefgh')
  })
})
