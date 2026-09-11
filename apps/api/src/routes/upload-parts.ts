import { Hono } from 'hono'
import { Readable } from 'node:stream'
import { db } from '../db/client.js'
import { uploadParts } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import { signObjectUploadPart } from '../lib/object-storage.js'
import { saveUploadPart } from '../lib/storage.js'
import { reserveUploadCapacity } from '../lib/upload-capacity.js'
import { requireUploadAuth, type UploadAuthVariables } from '../middleware/upload-auth.js'
import { directPartSchema, getSessionForUser } from './upload-inputs.js'

export function registerUploadParts(
  uploadRoutes: Hono<{ Variables: UploadAuthVariables }>,
) {
  uploadRoutes.put('/uploads/:id/parts/:partNumber', requireUploadAuth, async (c) => {
    const session = await getSessionForUser(
      c.req.param('id'),
      c.get('user'),
      c.get('uploadCredential'),
    )
    if (session === null)
      return jsonError(c, 404, 'not_found', 'Upload session not found')
    if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
    if (session.status !== 'active' || session.expiresAt <= new Date()) {
      return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
    }
    if (session.storageBackend === 's3') {
      return jsonError(
        c,
        409,
        'direct_upload_required',
        'Use direct object storage upload',
      )
    }

    const partNumber = Number(c.req.param('partNumber'))
    if (
      !Number.isInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > session.partCount
    ) {
      return jsonError(c, 400, 'invalid_part', 'Invalid upload part number')
    }
    const expectedSize = Math.min(
      session.partSize,
      session.sizeBytes - (partNumber - 1) * session.partSize,
    )
    const contentLength = Number(c.req.header('content-length'))
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 1 ||
      contentLength > expectedSize
    ) {
      return jsonError(c, 400, 'invalid_part_size', 'Invalid upload part size')
    }
    if (!c.req.raw.body)
      return jsonError(c, 400, 'file_required', 'Upload part is required')

    const capacity = await reserveUploadCapacity(contentLength)
    if (!capacity.accepted) {
      const message =
        capacity.reason === 'storage_quota_exceeded'
          ? 'Storage quota exceeded'
          : 'Insufficient disk space'
      return jsonError(c, 507, capacity.reason, message)
    }
    try {
      const saved = await saveUploadPart(
        session.id,
        partNumber,
        Readable.fromWeb(c.req.raw.body),
      )
      if (saved.sizeBytes !== contentLength) {
        return jsonError(c, 400, 'invalid_part_size', 'Upload part size mismatch')
      }
      await db
        .insert(uploadParts)
        .values({
          sessionId: session.id,
          partNumber,
          sizeBytes: saved.sizeBytes,
          sha256: saved.sha256,
        })
        .onConflictDoUpdate({
          target: [uploadParts.sessionId, uploadParts.partNumber],
          set: {
            sizeBytes: saved.sizeBytes,
            sha256: saved.sha256,
            createdAt: new Date(),
          },
        })
      return c.json({ part: { number: partNumber, sizeBytes: saved.sizeBytes } }, 201)
    } finally {
      capacity.release()
    }
  })

  uploadRoutes.post(
    '/uploads/:id/parts/:partNumber/sign',
    requireUploadAuth,
    async (c) => {
      const session = await getSessionForUser(
        c.req.param('id'),
        c.get('user'),
        c.get('uploadCredential'),
      )
      if (session === null)
        return jsonError(c, 404, 'not_found', 'Upload session not found')
      if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
      if (session.status !== 'active' || session.expiresAt <= new Date()) {
        return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
      }
      const partNumber = Number(c.req.param('partNumber'))
      if (
        !Number.isInteger(partNumber) ||
        partNumber < 1 ||
        partNumber > session.partCount
      ) {
        return jsonError(c, 400, 'invalid_part', 'Invalid upload part number')
      }
      if (session.storageBackend !== 's3' || !session.objectUploadId) {
        return jsonError(
          c,
          409,
          'direct_upload_unavailable',
          'Direct upload is unavailable',
        )
      }
      try {
        const url = await signObjectUploadPart(
          session.storageKey,
          session.objectUploadId,
          partNumber,
        )
        return c.json({ url })
      } catch {
        return jsonError(
          c,
          503,
          'object_storage_unavailable',
          'Object storage is unavailable',
        )
      }
    },
  )

  uploadRoutes.post(
    '/uploads/:id/parts/:partNumber/complete',
    requireUploadAuth,
    async (c) => {
      const session = await getSessionForUser(
        c.req.param('id'),
        c.get('user'),
        c.get('uploadCredential'),
      )
      if (session === null)
        return jsonError(c, 404, 'not_found', 'Upload session not found')
      if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
      if (
        session.storageBackend !== 's3' ||
        session.status !== 'active' ||
        session.expiresAt <= new Date()
      ) {
        return jsonError(c, 409, 'upload_expired', 'Upload session is no longer active')
      }
      const partNumber = Number(c.req.param('partNumber'))
      const input = directPartSchema.safeParse(await c.req.json().catch(() => null))
      const expectedSize = Math.min(
        session.partSize,
        session.sizeBytes - (partNumber - 1) * session.partSize,
      )
      if (
        !Number.isInteger(partNumber) ||
        partNumber < 1 ||
        partNumber > session.partCount ||
        !input.success ||
        input.data.sizeBytes !== expectedSize
      ) {
        return jsonError(c, 400, 'invalid_part', 'Invalid direct upload part')
      }
      await db
        .insert(uploadParts)
        .values({
          sessionId: session.id,
          partNumber,
          sizeBytes: input.data.sizeBytes,
          sha256: '',
          etag: input.data.etag,
        })
        .onConflictDoUpdate({
          target: [uploadParts.sessionId, uploadParts.partNumber],
          set: {
            sizeBytes: input.data.sizeBytes,
            sha256: '',
            etag: input.data.etag,
            createdAt: new Date(),
          },
        })
      return c.json(
        { part: { number: partNumber, sizeBytes: input.data.sizeBytes } },
        201,
      )
    },
  )
}
