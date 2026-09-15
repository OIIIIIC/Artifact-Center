import { describe, expect, it } from 'vitest'

import enUS from './locales/en-US.json'
import zhCN from './locales/zh-CN.json'

interface LocaleTree {
  [key: string]: string | LocaleTree
}

function flatten(tree: LocaleTree, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      entries.set(path, value)
    } else {
      flatten(value, path).forEach((message, childPath) => {
        entries.set(childPath, message)
      })
    }
  }
  return entries
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\{\s*([^},\s]+).*?\}\}/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value))
    .sort()
}

describe('国际化资源', () => {
  const zh = flatten(zhCN)
  const en = flatten(enUS)

  it('中英文拥有完全相同的翻译键', () => {
    expect([...zh.keys()].sort()).toEqual([...en.keys()].sort())
  })

  it('对应文案使用相同的插值变量', () => {
    const mismatches = [...zh.entries()]
      .filter(([key, message]) => {
        const translated = en.get(key)
        return (
          translated == null ||
          placeholders(message).join('|') !== placeholders(translated).join('|')
        )
      })
      .map(([key]) => key)

    expect(mismatches).toEqual([])
  })

  it('发布凭据文案不再使用机器人称呼', () => {
    const credentialKeys = [...zh.keys()].filter(
      (key) =>
        key === 'settings.navReleaseRobots' || /settings\..*releaseRobot/i.test(key),
    )

    expect(credentialKeys.map((key) => zh.get(key)).join('\n')).not.toContain('机器人')
    expect(credentialKeys.map((key) => en.get(key)).join('\n')).not.toMatch(
      /\brobots?\b/i,
    )
  })
})
