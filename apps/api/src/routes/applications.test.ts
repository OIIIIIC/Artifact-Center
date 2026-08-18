import { describe, expect, it } from 'vitest'

import { mapApp } from './applications.js'

describe('应用列表响应映射', () => {
  it('接受应用成员查询中返回的最新制品上传时间字符串', () => {
    const row = {
      id: 'application-1',
      name: 'Viewer application',
      applicationCode: 'viewer-application',
      description: 'Visible to a viewer',
      packageName: 'com.example.viewer',
      platform: 'android',
      regionId: 'region-1',
      repository: '',
      status: 'active',
      ownerName: 'Owner',
      latestVersion: '1.0.0',
      artifactCount: 1,
      latestArtifactUploadedAt: '2026-08-13T01:00:00.000Z',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    } as Parameters<typeof mapApp>[0]
    const region = {
      id: 'region-1',
      code: 'viewer-region',
      name: 'Viewer Region',
      sortOrder: 1,
      enabled: true,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    } as Parameters<typeof mapApp>[1]

    expect(mapApp(row, region).latestArtifactUploadedAt).toBe('2026-08-13T01:00:00.000Z')
  })
})
