import { describe, expect, it } from 'vitest'

import { distributionFilename } from './artifact-filename.js'

describe('distributionFilename', () => {
  it('uses the project code ahead of the product code', () => {
    expect(
      distributionFilename({
        regionCode: 'default',
        projectCode: 'shiyan',
        applicationCode: 'caregiver',
        version: '0.0.5',
        buildNumber: '1005',
        channel: 'stable',
        originalFilename: 'app.apk',
      }),
    ).toBe('shiyan_caregiver_v0.0.5_b1005_stable.apk')
  })
  it('generates a stable distribution filename from artifact metadata', () => {
    expect(
      distributionFilename({
        regionCode: 'Phoenix',
        applicationCode: 'medical-screen',
        version: 'v2.6.1',
        buildNumber: 'b426',
        channel: 'beta',
        originalFilename: 'app-release.APK',
      }),
    ).toBe('phoenix_medical-screen_v2.6.1_b426_beta.apk')
  })

  it('keeps the real source extension for Windows installers', () => {
    expect(
      distributionFilename({
        regionCode: 'East China',
        applicationCode: 'desktop-client',
        version: '3.0.0',
        buildNumber: '18',
        channel: 'stable',
        originalFilename: 'setup.msi',
      }),
    ).toBe('east-china_desktop-client_v3.0.0_b18_stable.msi')
  })
})
