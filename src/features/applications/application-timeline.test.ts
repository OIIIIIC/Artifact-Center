import { describe, expect, it } from 'vitest'

import { groupApplicationsByActivity } from './application-activity'
import type { Application } from '@/types/application'

const now = new Date('2026-08-12T12:00:00.000Z').getTime()

function createApplication(
  id: string,
  artifactCount: number,
  updatedAt: string,
  latestArtifactUploadedAt = updatedAt,
): Application {
  return {
    id,
    name: id,
    applicationCode: id,
    description: '',
    packageName: `com.example.${id}`,
    platform: 'android',
    region: {
      id: 'region-1',
      code: 'shanghai',
      name: '上海',
      sortOrder: 0,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    latestVersion: artifactCount ? '1.0.0' : '',
    latestArtifactUploadedAt: artifactCount ? latestArtifactUploadedAt : null,
    updatedAt,
    createdAt: '2026-01-01T00:00:00.000Z',
    owner: '管理员',
    artifactCount,
    status: 'active',
    repository: '',
  }
}

describe('groupApplicationsByActivity', () => {
  it('places published applications into release-time buckets and leaves empty ones last', () => {
    const groups = groupApplicationsByActivity(
      [
        createApplication('today', 2, '2026-08-12T08:00:00.000Z'),
        createApplication('week', 1, '2026-08-08T12:00:00.000Z'),
        createApplication('month', 3, '2026-07-20T12:00:00.000Z'),
        createApplication('older', 1, '2026-06-01T12:00:00.000Z'),
        createApplication('empty', 0, '2026-08-12T12:00:00.000Z'),
      ],
      now,
    )

    expect(groups.map((group) => group.bucket)).toEqual([
      'today',
      'week',
      'month',
      'older',
      'unpublished',
    ])
    expect(groups.at(-1)?.applications.map((application) => application.id)).toEqual([
      'empty',
    ])
  })

  it('uses the latest artifact upload time rather than a later metadata edit', () => {
    const groups = groupApplicationsByActivity(
      [
        createApplication(
          'metadata-edited-today',
          1,
          '2026-08-12T10:00:00.000Z',
          '2026-07-20T12:00:00.000Z',
        ),
      ],
      now,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.bucket).toBe('month')
  })
})
