import { createHash } from 'node:crypto'
import { open, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

export class ArtifactCenterError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ArtifactCenterError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function normalizeBaseUrl(url) {
  try {
    return new URL(url).toString().replace(/\/$/, '')
  } catch {
    throw new ArtifactCenterError('ARTIFACT_CENTER_URL must be an absolute URL')
  }
}

export class ArtifactCenterClient {
  constructor({ baseUrl = process.env.ARTIFACT_CENTER_URL || 'http://localhost:3001', token, fetchImpl = fetch } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.token = token
    this.fetch = fetchImpl
  }

  async request(path, init = {}) {
    const headers = new Headers(init.headers)
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)
    const relativePath = path.replace(/^\/+/, '')
    const response = await this.fetch(new URL(relativePath, `${this.baseUrl}/`), { ...init, headers })
    const contentType = response.headers.get('content-type') || ''
    const body = contentType.includes('application/json') ? await response.json() : await response.text()
    if (!response.ok) {
      const error = body?.error || {}
      throw new ArtifactCenterError(error.message || `Artifact Center returned HTTP ${response.status}`, {
        status: response.status,
        code: error.code,
        details: error.details,
      })
    }
    return body
  }

  get(path) { return this.request(path) }
  post(path, body) {
    return this.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  }
  patch(path, body) {
    return this.request(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  }

  async uploadArtifact({ applicationId, filePath, version, buildNumber, platform, channel = 'beta', releaseNotes = '' }) {
    const resolvedPath = resolve(filePath)
    const metadata = await stat(resolvedPath, { bigint: true })
    if (metadata.size < 1n) throw new ArtifactCenterError('Artifact file must not be empty')
    if (metadata.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new ArtifactCenterError('Artifact file is too large')
    const sizeBytes = Number(metadata.size)
    const filename = basename(filePath)
    const resumeKey = createHash('sha256').update(`${applicationId}:${resolvedPath}:${metadata.size}:${metadata.mtimeNs}`).digest('hex')
    const created = await this.post(`/applications/${encodeURIComponent(applicationId)}/uploads`, {
      resumeKey,
      filename,
      sizeBytes,
      version,
      buildNumber,
      platform,
      channel,
      releaseNotes,
      // MCP uploads never replace latest. Formal latest publication remains a
      // deliberate website/release workflow outside this plugin.
      markLatest: false,
    })
    const upload = created.upload
    const completed = new Set(upload.uploadedParts)
    const handle = await open(resolvedPath, 'r')
    try {
      for (let partNumber = 1; partNumber <= upload.partCount; partNumber += 1) {
        if (completed.has(partNumber)) continue
        const start = (partNumber - 1) * upload.partSize
        const expectedSize = Math.min(upload.partSize, sizeBytes - start)
        const buffer = Buffer.allocUnsafe(expectedSize)
        const { bytesRead } = await handle.read(buffer, 0, expectedSize, start)
        if (bytesRead !== expectedSize) throw new ArtifactCenterError('Artifact file changed while uploading')
        if (upload.transport === 'direct') {
          const signed = await this.post(`/uploads/${encodeURIComponent(upload.uploadId)}/parts/${partNumber}/sign`, {})
          const direct = await this.fetch(signed.url, { method: 'PUT', body: buffer })
          if (!direct.ok) throw new ArtifactCenterError(`Object storage returned HTTP ${direct.status}`)
          const etag = direct.headers.get('etag')
          if (!etag) throw new ArtifactCenterError('Object storage response did not include ETag')
          await this.post(`/uploads/${encodeURIComponent(upload.uploadId)}/parts/${partNumber}/complete`, { etag, sizeBytes: buffer.length })
        } else {
          await this.request(`/uploads/${encodeURIComponent(upload.uploadId)}/parts/${partNumber}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(buffer.length) }, body: buffer,
          })
        }
      }
    } finally {
      await handle.close()
    }
    return this.post(`/uploads/${encodeURIComponent(upload.uploadId)}/complete`, {})
  }
}

export function releaseCredentialClient(env = process.env, fetchImpl = fetch) {
  const token = env.ARTIFACT_CENTER_TOKEN?.trim()
  if (!token) {
    throw new ArtifactCenterError('ARTIFACT_CENTER_TOKEN is required. Configure a platform Release Credential before using this MCP.')
  }
  if (!token.startsWith('acrt_')) {
    throw new ArtifactCenterError('ARTIFACT_CENTER_TOKEN must be an Artifact Center Release Credential (acrt_...).')
  }
  return new ArtifactCenterClient({ baseUrl: env.ARTIFACT_CENTER_URL, token, fetchImpl })
}
