import { describe, expect, it } from 'vitest'

import {
  getApplicationDownloadRiskStatus,
  getArtifactRiskStatus,
  type Artifact,
} from './artifact'

const artifact: Artifact = {
  id: 'artifact-1',
  applicationId: 'application-1',
  version: '1.0.5',
  buildNumber: '108',
  platform: 'android',
  sizeBytes: 1024,
  uploadedAt: '2026-08-25T00:00:00.000Z',
  uploader: '张盈睿',
  status: 'stable',
  channel: 'stable',
  releaseNotes: '',
  filename: 'demo-v1.0.5-b108.apk',
}

describe('下载风险状态', () => {
  it.each([
    ['beta', 'beta'],
    ['deprecated', 'deprecated'],
    ['archived', 'archived'],
  ] as const)('识别制品 %s 状态', (status, expectedRisk) => {
    expect(getArtifactRiskStatus({ ...artifact, status })).toBe(expectedRisk)
  })

  it('识别测试渠道，即使制品本身标为最新', () => {
    expect(
      getArtifactRiskStatus({ ...artifact, status: 'latest', channel: 'beta' }),
    ).toBe('beta')
  })

  it.each([
    ['beta', 'applicationBeta'],
    ['deprecated', 'applicationDeprecated'],
    ['archived', 'applicationArchived'],
    ['active', null],
    ['new', null],
  ] as const)('识别应用 %s 状态', (status, expectedRisk) => {
    expect(getApplicationDownloadRiskStatus(status)).toBe(expectedRisk)
  })
})
