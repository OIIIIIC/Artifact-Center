import { describe, expect, it } from 'vitest'

import type { Application } from '@/types/application'
import { detectFileKind, mockHash, mockParseFile } from './mock-parse'

function createApplication(latestVersion: string): Application {
  return {
    id: 'app-test',
    name: '测试应用',
    description: '用于上传解析测试',
    packageName: 'com.example.test',
    platform: 'android',
    region: {
      id: 'region-test',
      name: '测试地域',
      code: 'test',
      sortOrder: 0,
      enabled: true,
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
    },
    repository: '',
    latestVersion,
    updatedAt: '2026-07-30T00:00:00.000Z',
    createdAt: '2026-07-30T00:00:00.000Z',
    owner: 'Tester',
    artifactCount: 0,
    status: 'active',
  }
}

describe('上传文件预解析', () => {
  it.each([
    ['app.APK', 'apk'],
    ['bundle.aab', 'aab'],
    ['setup.msi', 'exe'],
    ['archive.zip', 'zip'],
    ['Docker-image', 'docker'],
  ] as const)('识别 %s 为 %s', (filename, kind) => {
    expect(detectFileKind(filename)).toBe(kind)
  })

  it.each([
    ['artifact.apk', 1],
    ['中文安装包.zip', 1024],
    ['setup.exe', 4_294_967_295],
  ])('生成合法的 64 位十六进制摘要：%s', (name, size) => {
    expect(mockHash(name, size)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('首次上传建议从 1.0.0 开始', () => {
    const result = mockParseFile(
      { name: 'artifact.apk', size: 1024 },
      createApplication(''),
    )

    expect(result.suggestedVersion).toBe('1.0.0')
  })

  it('已有版本默认递增补丁号，并优先采用文件名中的版本', () => {
    const application = createApplication('1.2.3-beta')

    expect(
      mockParseFile({ name: 'artifact.apk', size: 1024 }, application).suggestedVersion,
    ).toBe('1.2.4')
    expect(
      mockParseFile({ name: 'artifact-2.0.0.apk', size: 1024 }, application)
        .suggestedVersion,
    ).toBe('2.0.0')
  })
})
