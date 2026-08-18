import { describe, expect, it } from 'vitest'

import {
  createReleaseCredentialToken,
  hashReleaseCredentialToken,
  isReleaseCredentialToken,
  releaseCredentialAllowsUpload,
} from './release-credential.js'

describe('Release Credential', () => {
  it('creates a high-entropy token and stores only a deterministic digest', () => {
    const token = createReleaseCredentialToken()
    const digest = hashReleaseCredentialToken(token)

    expect(isReleaseCredentialToken(token)).toBe(true)
    expect(token).not.toContain(digest)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(hashReleaseCredentialToken(token)).toBe(digest)
  })

  it('allows beta and stable releases with explicit build numbers', () => {
    const base = {
      channel: 'beta',
      markLatest: false,
      buildNumber: '42',
    }

    expect(releaseCredentialAllowsUpload(base)).toBe(true)
    expect(releaseCredentialAllowsUpload({ ...base, channel: 'stable' })).toBe(true)
    expect(
      releaseCredentialAllowsUpload({ ...base, channel: 'stable', markLatest: true }),
    ).toBe(true)
    expect(releaseCredentialAllowsUpload({ ...base, markLatest: true })).toBe(false)
    expect(releaseCredentialAllowsUpload({ ...base, channel: 'internal' })).toBe(false)
    expect(releaseCredentialAllowsUpload({ ...base, buildNumber: '' })).toBe(false)
  })
})
