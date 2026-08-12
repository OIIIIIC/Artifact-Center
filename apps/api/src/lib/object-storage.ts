import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  UploadPartCommand,
  S3Client,
  type CompletedPart,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash, randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import { env } from '../env.js'

const config = env.objectStorage
const client = config
  ? new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    })
  : null

function requireClient() {
  if (!config || !client) throw new Error('object_storage_disabled')
  return { config, client }
}

export function objectStorageEnabled() {
  return client !== null
}

export function objectStorageKeyFor(applicationId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `artifacts/${applicationId}/${randomUUID()}-${safe}`
}

export async function createObjectMultipartUpload(key: string, filename: string) {
  const { client: s3, config: options } = requireClient()
  const result = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: options.bucket,
      Key: key,
      ContentType: 'application/octet-stream',
      ContentDisposition: `attachment; filename="${filename.replace(/["\\]/g, '_')}"`,
    }),
  )
  if (!result.UploadId) throw new Error('object_storage_upload_id_missing')
  return result.UploadId
}

export async function signObjectUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
) {
  const { config: options } = requireClient()
  const signingClient = new S3Client({
    endpoint: options.publicEndpoint,
    region: options.region,
    forcePathStyle: true,
    credentials: { accessKeyId: options.accessKey, secretAccessKey: options.secretKey },
  })
  return getSignedUrl(
    signingClient,
    new UploadPartCommand({
      Bucket: options.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: 15 * 60 },
  )
}

export async function completeObjectMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPart[],
) {
  const { client: s3, config: options } = requireClient()
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: options.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  )
}

export async function abortObjectMultipartUpload(key: string, uploadId: string) {
  if (!client || !config) return
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: uploadId,
    }),
  )
}

export async function openObjectDownloadStream(key: string): Promise<Readable | null> {
  const { client: s3, config: options } = requireClient()
  try {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: options.bucket, Key: key }),
    )
    return result.Body ? (result.Body as Readable) : null
  } catch {
    return null
  }
}

export async function deleteObject(key: string) {
  if (!client || !config) return
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
}

export async function hashObject(key: string) {
  const stream = await openObjectDownloadStream(key)
  if (!stream) throw new Error('object_missing')
  const hash = createHash('sha256')
  let sizeBytes = 0
  for await (const chunk of stream) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    sizeBytes += data.length
    hash.update(data)
  }
  return { sizeBytes, sha256: hash.digest('hex') }
}
