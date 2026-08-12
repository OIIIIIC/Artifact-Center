import { describe, expect, it } from 'vitest'

import { MultipartUploadError, streamMultipartForm } from './multipart-upload.js'

function multipartRequest(form: FormData) {
  return new Request('http://artifact-center.test/upload', {
    method: 'POST',
    body: form,
  })
}

describe('流式 multipart 上传', () => {
  it('边读取文件流边保留表单字段，不聚合整个请求体', async () => {
    const form = new FormData()
    form.set('version', '1.2.3')
    form.set('channel', 'stable')
    form.set('file', new Blob(['artifact content']), 'mobile.apk')
    let filename = ''
    let content = ''

    const fields = await streamMultipartForm(multipartRequest(form), {
      limits: { files: 1, fileSize: 1024 },
      onFile: async (file) => {
        filename = file.filename
        for await (const chunk of file.stream) content += Buffer.from(chunk).toString()
      },
    })

    expect(fields).toMatchObject({ version: '1.2.3', channel: 'stable' })
    expect(filename).toBe('mobile.apk')
    expect(content).toBe('artifact content')
  })

  it('拒绝多个文件和超过限制的文件', async () => {
    const twoFiles = new FormData()
    twoFiles.set('file', new Blob(['one']), 'one.apk')
    twoFiles.append('file', new Blob(['two']), 'two.apk')

    await expect(
      streamMultipartForm(multipartRequest(twoFiles), {
        limits: { files: 2, fileSize: 1024 },
        onFile: async (file) => {
          for await (const _ of file.stream) {
            // Consume the stream to simulate a storage writer.
          }
        },
      }),
    ).rejects.toMatchObject({
      code: 'multiple_files',
    } satisfies Partial<MultipartUploadError>)

    const oversized = new FormData()
    oversized.set('file', new Blob(['too long']), 'large.apk')
    await expect(
      streamMultipartForm(multipartRequest(oversized), {
        limits: { files: 1, fileSize: 3 },
        onFile: async (file) => {
          for await (const _ of file.stream) {
            // Consume the stream to simulate a storage writer.
          }
        },
      }),
    ).rejects.toMatchObject({
      code: 'file_too_large',
    } satisfies Partial<MultipartUploadError>)
  })
})
