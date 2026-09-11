import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { registerApplicationBulk } from './application-bulk.js'
import { registerApplicationDetails } from './application-details.js'
import { registerApplicationDirectory } from './application-directory.js'
import { registerApplicationHistory } from './application-history.js'
import { registerApplicationMembers } from './application-members.js'
export { mapApp } from '../lib/application-response.js'
export {
  bulkApplicationAppearanceSchema,
  bulkApplicationCodesSchema,
} from './application-inputs.js'
export const applicationRoutes = new Hono<{ Variables: AuthVariables }>()

applicationRoutes.use('*', requireAuth)

registerApplicationDirectory(applicationRoutes)

registerApplicationBulk(applicationRoutes)

registerApplicationDetails(applicationRoutes)

registerApplicationHistory(applicationRoutes)

registerApplicationMembers(applicationRoutes)
