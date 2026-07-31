import { describe, expect, it } from 'vitest'

import { checkPassword } from './password'

describe('前端密码策略', () => {
  it.each([
    '',
    'short1',
    'a'.repeat(73) + '1',
    'Password123',
    '12345678',
    'abcdefgh',
    'aaaaaaaa1',
    'abcdX9!z',
    'artifact1',
  ])('拒绝弱密码：%s', (password) => {
    expect(checkPassword(password).ok).toBe(false)
  })

  it.each(['Artifact2026!', 'Longer-passphrase-2026', '制品中心-2026-安全'])(
    '接受符合策略的密码：%s',
    (password) => {
      expect(checkPassword(password).ok).toBe(true)
    },
  )

  it('拒绝与当前密码相同或确认不一致的新密码', () => {
    const password = 'Artifact2026!'

    expect(checkPassword(password, { current: password }).issues).toContain(
      'same_as_current',
    )
    expect(checkPassword(password, { confirm: 'Artifact2027!' }).issues).toContain(
      'mismatch',
    )
  })
})
