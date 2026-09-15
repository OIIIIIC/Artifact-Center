import { describe, expect, it } from 'vitest'
import { normalizeRepository, repositoryBindingsSchema } from './repository-binding.js'

describe('仓库发布绑定', () => {
  it('SSH 与 HTTPS 克隆地址匹配，但保留路径大小写', () => {
    expect(normalizeRepository('git@Git.Example:Team/app.git')).toBe(
      normalizeRepository('https://git.example/Team/app/'),
    )
    expect(normalizeRepository('ssh://git@git.example/Team/app.git')).toBe(
      'git.example/Team/app',
    )
    expect(normalizeRepository('https://git.example/team/app')).not.toBe(
      'git.example/Team/app',
    )
  })
  it('拒绝凭据、页面链接参数、通配分支和越界目录', () => {
    const base = {
      repository: 'https://git.example/team/app',
      branch: 'main',
      directory: '',
    }
    for (const change of [
      { repository: 'https://user:password@git.example/app' },
      { repository: 'https://git.example/app?token=x' },
      { repository: 'not a URL' },
      { branch: 'release/*' },
      { directory: '../app' },
      { directory: 'C:\\app' },
    ]) {
      expect(repositoryBindingsSchema.safeParse([{ ...base, ...change }]).success).toBe(
        false,
      )
    }
  })
  it('规范化根目录并拒绝同一应用中的重复绑定', () => {
    const binding = {
      repository: 'https://git.example/team/app.git',
      branch: 'main',
      directory: '.',
    }
    expect(repositoryBindingsSchema.parse([binding])[0].directory).toBe('')
    expect(
      repositoryBindingsSchema.safeParse([
        binding,
        { ...binding, repository: 'git@git.example:team/app' },
      ]).success,
    ).toBe(false)
  })
})
