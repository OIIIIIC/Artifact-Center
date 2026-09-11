import { Hono } from 'hono'
import { type UploadAuthVariables } from '../middleware/upload-auth.js'
import { registerUploadCancellation } from './upload-cancellation.js'
import { registerUploadCompletion } from './upload-completion.js'
import { registerUploadParts } from './upload-parts.js'
import { registerReleaseApplications } from './upload-release-applications.js'
import { registerReleaseVerification } from './upload-release-verification.js'
import { registerUploadSessions } from './upload-sessions.js'

export { releaseApplicationQuerySchema } from './upload-inputs.js'
export const uploadRoutes = new Hono<{ Variables: UploadAuthVariables }>()

registerReleaseApplications(uploadRoutes)

registerUploadSessions(uploadRoutes)

registerUploadParts(uploadRoutes)

registerUploadCompletion(uploadRoutes)

registerReleaseVerification(uploadRoutes)

registerUploadCancellation(uploadRoutes)
