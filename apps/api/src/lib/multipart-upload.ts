import { Readable } from 'node:stream'

import Busboy, { type BusboyConfig, type FileInfo } from 'busboy'

export class MultipartUploadError extends Error {
  constructor(
    public readonly code:
      'invalid_multipart' | 'file_required' | 'multiple_files' | 'file_too_large',
  ) {
    super(code)
  }
}

type MultipartFile = {
  fieldName: string
  filename: string
  info: FileInfo
  stream: Readable
}

type StreamMultipartFormOptions = {
  limits: BusboyConfig['limits']
  onFile: (file: MultipartFile) => Promise<void>
}

/**
 * Parse a multipart request without materializing its file payload in memory.
 * The caller owns the file stream and should persist it with backpressure.
 */
export async function streamMultipartForm(
  request: Request,
  { limits, onFile }: StreamMultipartFormOptions,
): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type')
  if (!contentType?.startsWith('multipart/form-data')) {
    throw new MultipartUploadError('invalid_multipart')
  }
  if (!request.body) throw new MultipartUploadError('invalid_multipart')

  const parser = Busboy({ headers: { 'content-type': contentType }, limits })
  const fields: Record<string, string> = {}
  const fileTasks: Promise<void>[] = []
  let fileCount = 0
  let error: MultipartUploadError | null = null

  parser.on('field', (name, value) => {
    fields[name] = value
  })
  parser.on('file', (fieldName, stream, info) => {
    fileCount += 1
    if (fileCount > 1) {
      error ??= new MultipartUploadError('multiple_files')
      stream.resume()
      return
    }

    stream.once('limit', () => {
      error ??= new MultipartUploadError('file_too_large')
    })
    fileTasks.push(
      onFile({ fieldName, filename: info.filename, info, stream }).catch((cause) => {
        if (cause instanceof MultipartUploadError) {
          error ??= cause
          return
        }
        throw cause
      }),
    )
  })

  const parseComplete = new Promise<void>((resolve, reject) => {
    parser.once('finish', resolve)
    parser.once('error', reject)
    parser.once('partsLimit', () => {
      error ??= new MultipartUploadError('invalid_multipart')
    })
    parser.once('filesLimit', () => {
      error ??= new MultipartUploadError('multiple_files')
    })
  })

  Readable.fromWeb(request.body).pipe(parser)
  await parseComplete
  await Promise.all(fileTasks)

  if (error) throw error
  if (fileCount === 0) throw new MultipartUploadError('file_required')
  return fields
}
