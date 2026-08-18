import type { Application } from '@/types/application'
import type { UploadChannel } from '@/types/upload'

function filenameSegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .replace(/-{2,}/g, '-')
  return normalized || fallback
}

export function previewDistributionFilename(input: {
  application: Pick<Application, 'applicationCode' | 'region'>
  version: string
  buildNumber: string
  channel: UploadChannel
  originalFilename: string
}): string {
  const extension = /\.([a-zA-Z0-9]+)$/.exec(input.originalFilename.trim())?.[1]
  const region = filenameSegment(input.application.region.code, 'region')
  const application = filenameSegment(input.application.applicationCode, 'application')
  const version = filenameSegment(input.version.replace(/^v/i, ''), 'unknown')
  const build = filenameSegment(input.buildNumber.replace(/^b/i, ''), '1')

  return `${region}_${application}_v${version}_b${build}_${input.channel}.${extension?.toLowerCase() ?? 'bin'}`
}
