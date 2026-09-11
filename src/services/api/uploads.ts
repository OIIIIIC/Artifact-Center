import {
  request,
  requestExternalUploadPart,
  requestMultipart,
  requestUploadPart,
  type UploadProgress,
} from '@/services/http'
import type { ApplicationPlatform } from '@/types/application'
import type { Artifact } from '@/types/artifact'
import type { UploadChannel } from '@/types/upload'
import type { ApiArtifact } from './artifact-model'
import { mapArtifact } from './artifact-model'

export type UploadArtifactFields = {
  version: string
  buildNumber?: string
  channel?: UploadChannel
  platform?: ApplicationPlatform
  releaseNotes?: string
  markLatest?: boolean
}

export async function apiUploadArtifact(
  appId: string,
  file: File,
  fields: UploadArtifactFields,
  onProgress?: UploadProgress,
  signal?: AbortSignal,
): Promise<Artifact> {
  const form = new FormData()
  form.append('file', file)
  form.append('version', fields.version)
  if (fields.buildNumber) form.append('buildNumber', fields.buildNumber)
  if (fields.channel) form.append('channel', fields.channel)
  if (fields.platform) form.append('platform', fields.platform)
  if (fields.releaseNotes != null) form.append('releaseNotes', fields.releaseNotes)
  form.append('markLatest', fields.markLatest === false ? 'false' : 'true')

  const artifact = await requestMultipart<ApiArtifact>(
    `/applications/${appId}/artifacts`,
    form,
    onProgress,
    signal,
  )
  return mapArtifact(artifact)
}

type ResumableUploadDto = {
  uploadId: string
  partSize: number
  partCount: number
  uploadedParts: number[]
  expiresAt: string
  transport: 'proxy' | 'direct'
}

type ResumableUploadFields = UploadArtifactFields & {
  resumeKey: string
}

function resumableUploadBody(file: File, fields: ResumableUploadFields) {
  return {
    resumeKey: fields.resumeKey,
    filename: file.name,
    sizeBytes: file.size,
    version: fields.version,
    buildNumber: fields.buildNumber ?? '',
    channel: fields.channel ?? 'stable',
    platform: fields.platform,
    releaseNotes: fields.releaseNotes ?? '',
    markLatest: fields.markLatest !== false,
  }
}

export async function apiCreateResumableUpload(
  appId: string,
  file: File,
  fields: ResumableUploadFields,
): Promise<ResumableUploadDto> {
  const data = await request<{ upload: ResumableUploadDto }>(
    `/applications/${appId}/uploads`,
    {
      method: 'POST',
      body: resumableUploadBody(file, fields),
    },
  )
  return data.upload
}

export function apiUploadResumablePart(
  uploadId: string,
  partNumber: number,
  body: Blob,
  onProgress?: UploadProgress,
  signal?: AbortSignal,
) {
  return requestUploadPart(
    `/uploads/${uploadId}/parts/${partNumber}`,
    body,
    onProgress,
    signal,
  )
}

export async function apiUploadDirectResumablePart(
  uploadId: string,
  partNumber: number,
  body: Blob,
  onProgress?: UploadProgress,
  signal?: AbortSignal,
) {
  const signed = await request<{ url: string }>(
    `/uploads/${uploadId}/parts/${partNumber}/sign`,
    {
      method: 'POST',
      body: {},
    },
  )
  const etag = await requestExternalUploadPart(signed.url, body, onProgress, signal)
  await request(`/uploads/${uploadId}/parts/${partNumber}/complete`, {
    method: 'POST',
    body: { etag, sizeBytes: body.size },
  })
}

export async function apiCompleteResumableUpload(uploadId: string): Promise<Artifact> {
  const data = await request<{ artifact: ApiArtifact }>(`/uploads/${uploadId}/complete`, {
    method: 'POST',
    body: {},
  })
  return mapArtifact(data.artifact)
}
