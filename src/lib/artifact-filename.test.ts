import { describe, expect, it } from 'vitest'

import { previewDistributionFilename } from '@/lib/artifact-filename'

describe('previewDistributionFilename', () => {
  it('matches the filename shown during upload review', () => {
    expect(
      previewDistributionFilename({
        application: {
          applicationCode: 'medical-screen',
          region: {
            id: 'region-1',
            code: 'Phoenix',
            name: '凤凰',
            sortOrder: 1,
            enabled: true,
            createdAt: '2026-08-18T00:00:00.000Z',
            updatedAt: '2026-08-18T00:00:00.000Z',
          },
        },
        version: '2.6.1',
        buildNumber: '426',
        channel: 'beta',
        originalFilename: 'app-release.apk',
      }),
    ).toBe('phoenix_medical-screen_v2.6.1_b426_beta.apk')
  })
})
