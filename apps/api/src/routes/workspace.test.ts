import { describe, expect, it } from 'vitest'

import { serializeWorkspace, workspacePreferencesSchema } from './workspace.js'

describe('个人工作台', () => {
  it('按收藏与访问时间排序，并只返回最近四个应用', () => {
    const row = (applicationId: string, favoriteAt: string, viewedAt: string) => ({
      userId: '00000000-0000-4000-8000-000000000001',
      applicationId,
      favorite: true,
      favoriteAt: new Date(favoriteAt),
      lastViewedAt: new Date(viewedAt),
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date(viewedAt),
    })
    const rows = [
      row('00000000-0000-4000-8000-000000000001', '2026-08-01', '2026-08-01'),
      row('00000000-0000-4000-8000-000000000002', '2026-08-05', '2026-08-05'),
      row('00000000-0000-4000-8000-000000000003', '2026-08-03', '2026-08-03'),
      row('00000000-0000-4000-8000-000000000004', '2026-08-04', '2026-08-04'),
      row('00000000-0000-4000-8000-000000000005', '2026-08-02', '2026-08-02'),
    ]

    const result = serializeWorkspace(rows, undefined)

    expect(result.favoriteApplicationIds[0]).toBe('00000000-0000-4000-8000-000000000002')
    expect(result.recentApplications).toHaveLength(4)
    expect(result.recentApplications.map((visit) => visit.applicationId)).not.toContain(
      '00000000-0000-4000-8000-000000000001',
    )
    expect(result.preferences).toEqual({
      platform: 'all',
      sort: 'updated',
      regionId: null,
      query: '',
      favoriteOnly: false,
      responsibleOnly: false,
      collapsed: false,
    })
  })

  it('拒绝空偏好和非法平台', () => {
    expect(workspacePreferencesSchema.safeParse({}).success).toBe(false)
    expect(workspacePreferencesSchema.safeParse({ platform: 'ios' }).success).toBe(false)
    expect(
      workspacePreferencesSchema.safeParse({ platform: 'android', collapsed: true })
        .success,
    ).toBe(true)
  })

  it('保存完整的应用目录筛选状态', () => {
    const result = workspacePreferencesSchema.safeParse({
      query: '终端',
      platform: 'windows',
      sort: 'name',
      regionId: '00000000-0000-4000-8000-000000000010',
      favoriteOnly: true,
      responsibleOnly: true,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toMatchObject({
      query: '终端',
      favoriteOnly: true,
      responsibleOnly: true,
    })
  })
})
