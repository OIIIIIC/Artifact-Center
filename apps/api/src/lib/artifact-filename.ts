import { artifactExtension } from './artifact-types.js'
export type DistributionFilenameInput = {
  regionCode: string
  projectCode?: string | null
  applicationCode: string
  version: string
  buildNumber: string
  channel: 'stable' | 'beta' | 'internal' | 'deprecated'
  originalFilename: string
}

const EXTENSION_PATTERN = /\.([a-zA-Z0-9]+)$/

function filenameSegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .replace(/-{2,}/g, '-')
  return normalized || fallback
}

/**
 * Builds the immutable user-facing filename for an Artifact.
 * Metadata remains authoritative; the filename is not parsed back into domain fields.
 */
export function distributionFilename(input: DistributionFilenameInput): string {
  const extension =
    artifactExtension(input.originalFilename)?.slice(1) ??
    EXTENSION_PATTERN.exec(input.originalFilename.trim())?.[1]?.toLowerCase() ??
    'bin'
  const prefix = filenameSegment(input.projectCode || input.regionCode, 'region')
  const application = filenameSegment(input.applicationCode, 'application')
  const version = filenameSegment(input.version.replace(/^v/i, ''), 'unknown')
  const build = filenameSegment(input.buildNumber.replace(/^b/i, ''), '1')

  return `${prefix}_${application}_v${version}_b${build}_${input.channel}.${extension}`
}
