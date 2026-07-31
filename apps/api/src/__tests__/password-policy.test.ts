import { describe, expect, it } from 'vitest'

import { validatePassword } from '../lib/password-policy.js'

describe('密码策略', () => {
  it.each([
    ['', '空密码'],
    ['short1', '长度不足'],
    ['a'.repeat(73) + '1', '长度超限'],
    ['Password123', '常见弱密码不区分大小写'],
    ['12345678', '缺少字母'],
    ['abcdefgh', '缺少数字'],
    ['aaaaaaaa1', '字符组合强度不足'],
    ['abcdX9!z', '包含连续字符'],
    ['artifact1', '整体强度不足'],
  ])('拒绝%s（%s）', (password) => {
    expect(validatePassword(password)).toMatchObject({
      ok: false,
      code: 'weak_password',
    })
  })

  it.each(['Artifact2026!', 'Longer-passphrase-2026', '制品中心-2026-安全'])(
    '接受符合策略的密码：%s',
    (password) => {
      expect(validatePassword(password)).toEqual({ ok: true })
    },
  )
})
