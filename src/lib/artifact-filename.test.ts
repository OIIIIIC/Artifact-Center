import { describe, expect, it } from 'vitest'

import { previewDistributionFilename } from '@/lib/artifact-filename'

describe('previewDistributionFilename', () => {
  it.each([
    [undefined, 'app-release.apk', 'phoenix_medical-screen_v2.6.1_b426_beta.apk'],
    ['shiyan', 'app-release.apk', 'shiyan_medical-screen_v2.6.1_b426_beta.apk'],
    ['henan', 'agent.tar.gz', 'henan_medical-screen_v2.6.1_b426_beta.tar.gz'],
  ])(
    'matches upload naming for project %s and file %s',
    (projectCode, originalFilename, expected) => {
      expect(
        previewDistributionFilename({
          application: {
            applicationCode: 'medical-screen',
            projectCode,
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
          originalFilename,
        }),
      ).toBe(expected)
    },
  )
})
