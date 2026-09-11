import { normalizePlatform } from '../lib/artifact-types.js'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { applications, regions, uploadSessions } from '../db/schema.js'
import { releaseCredentialAllowsUpload } from '../lib/release-credential.js'
import { hasApplicationRole } from '../middleware/application-access.js'
import { type UploadCredential } from '../middleware/upload-auth.js'

export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024

export const PART_SIZE_BYTES = 8 * 1024 * 1024

export const MAX_PART_COUNT = Math.ceil(MAX_UPLOAD_BYTES / PART_SIZE_BYTES)

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export const platformEnum = z.preprocess(
  normalizePlatform,
  z.enum(['android', 'windows', 'linux']),
)

export const channelEnum = z.enum(['stable', 'beta', 'internal', 'deprecated'])

export const createUploadSchema = z.object({
  resumeKey: z.string().min(12).max(160),
  filename: z.string().min(1).max(500),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  version: z.string().trim().min(1).max(64),
  buildNumber: z.string().trim().max(64).optional().default(''),
  platform: platformEnum,
  channel: channelEnum.optional().default('stable'),
  releaseNotes: z.string().max(8000).optional().default(''),
  markLatest: z.boolean().optional().default(true),
})

export const releaseApplicationQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  platform: platformEnum.optional(),
})

export {
  resolveArtifactType,
  platformForArtifactType,
  type ArtifactType,
} from '../lib/artifact-types.js'

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

export function fieldsFromInput(
  input: z.infer<typeof createUploadSchema>,
): Record<string, string> {
  return {
    version: input.version,
    buildNumber: input.buildNumber,
    platform: input.platform,
    channel: input.channel,
    releaseNotes: input.releaseNotes,
    markLatest: input.markLatest ? 'true' : 'false',
  }
}

export function mapSession(session: typeof uploadSessions.$inferSelect, parts: number[]) {
  return {
    uploadId: session.id,
    partSize: session.partSize,
    partCount: session.partCount,
    uploadedParts: parts,
    transport: session.storageBackend === 's3' ? 'direct' : 'proxy',
    expiresAt: session.expiresAt.toISOString(),
  }
}

export const directPartSchema = z.object({
  etag: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive(),
})

export function mapReleaseApplicationTarget(row: {
  application: typeof applications.$inferSelect
  region: typeof regions.$inferSelect
  accessRole: 'admin' | 'maintainer'
}) {
  return {
    id: row.application.id,
    name: row.application.name,
    applicationCode: row.application.applicationCode,
    packageName: row.application.packageName,
    platform: row.application.platform,
    status: row.application.status,
    accessRole: row.accessRole,
    region: {
      id: row.region.id,
      code: row.region.code,
      name: row.region.name,
    },
  }
}

export async function getSessionForUser(
  id: string,
  user: { sub: string; role: string },
  credential: UploadCredential,
) {
  const [session] = await db
    .select()
    .from(uploadSessions)
    .where(eq(uploadSessions.id, id))
    .limit(1)
  if (!session) return null
  const ownsSession = session.uploaderId === user.sub
  const canMaintain = await hasApplicationRole(user, session.applicationId, 'maintainer')
  if (credential.kind === 'release-credential') {
    const allowed = releaseCredentialAllowsUpload({
      channel: session.fields.channel,
      markLatest: session.fields.markLatest !== 'false',
      buildNumber: session.fields.buildNumber ?? '',
    })
    return allowed && canMaintain ? session : undefined
  }
  return ownsSession || canMaintain ? session : undefined
}
