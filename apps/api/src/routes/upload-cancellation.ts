import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import { uploadSessions } from '../db/schema.js'
import { jsonError } from '../lib/errors.js'
import { abortObjectMultipartUpload } from '../lib/object-storage.js'
import { deleteUploadSessionFiles } from '../lib/storage.js'
import { requireUploadAuth, type UploadAuthVariables } from '../middleware/upload-auth.js'
import { getSessionForUser } from './upload-inputs.js'

export function registerUploadCancellation(
  uploadRoutes: Hono<{ Variables: UploadAuthVariables }>,
) {
  uploadRoutes.delete('/uploads/:id', requireUploadAuth, async (c) => {
    const session = await getSessionForUser(
      c.req.param('id'),
      c.get('user'),
      c.get('uploadCredential'),
    )
    if (session === null)
      return jsonError(c, 404, 'not_found', 'Upload session not found')
    if (!session) return jsonError(c, 403, 'forbidden', 'Insufficient application role')
    await db.delete(uploadSessions).where(eq(uploadSessions.id, session.id))
    if (session.storageBackend === 's3' && session.objectUploadId) {
      await abortObjectMultipartUpload(session.storageKey, session.objectUploadId)
    }
    await deleteUploadSessionFiles(session.id)
    return c.json({ ok: true })
  })
}
