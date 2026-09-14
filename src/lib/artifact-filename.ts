import { distributionFilename } from '../../apps/api/src/lib/artifact-filename'
import type { Application } from '@/types/application'
import type { UploadChannel } from '@/types/upload'

export function previewDistributionFilename(input: {
  application: Pick<Application, 'applicationCode' | 'region' | 'projectCode'>
  version: string
  buildNumber: string
  channel: UploadChannel
  originalFilename: string
}): string {
  return distributionFilename({
    ...input,
    regionCode: input.application.region.code,
    projectCode: input.application.projectCode,
    applicationCode: input.application.applicationCode,
  })
}
