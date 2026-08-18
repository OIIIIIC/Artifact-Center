import { createHash, randomBytes } from 'node:crypto'

export const RELEASE_CREDENTIAL_PREFIX = 'acrt_'

export function createReleaseCredentialToken() {
  return `${RELEASE_CREDENTIAL_PREFIX}${randomBytes(32).toString('base64url')}`
}

export function hashReleaseCredentialToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isReleaseCredentialToken(token: string) {
  return token.startsWith(RELEASE_CREDENTIAL_PREFIX) && token.length > 40
}

export function releaseCredentialAllowsUpload(input: {
  channel: string
  markLatest: boolean
  buildNumber: string
}) {
  return (
    (input.channel === 'beta' || input.channel === 'stable') &&
    (input.channel !== 'beta' || input.markLatest === false) &&
    input.buildNumber.trim().length > 0
  )
}
