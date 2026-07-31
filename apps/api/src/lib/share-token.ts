import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { env } from '../env.js'

/** 公开 URL 中的明文令牌字节长度（base64url）。 */
const TOKEN_BYTES = 24

/** 生成不可猜测的分享令牌（仅创建时返回给客户端一次）。 */
export function createShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** 用服务端 pepper 对明文令牌做 HMAC-SHA256，数据库只存摘要。 */
export function hashShareToken(token: string): string {
  return createHmac('sha256', env.shareTokenPepper).update(token, 'utf8').digest('hex')
}

/** 固定时间比较两个十六进制摘要，避免时序旁路。 */
export function shareTokenHashesEqual(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, 'hex')
    const b = Buffer.from(right, 'hex')
    if (a.length === 0 || a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** 列表/审计展示用短前缀，不可用于鉴权。 */
export function shareTokenPrefix(token: string): string {
  return token.slice(0, 8)
}
