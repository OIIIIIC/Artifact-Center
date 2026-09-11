import { normalizePlatform } from '../lib/artifact-types.js'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { projects } from '../db/schema.js'

export const platformEnum = z.preprocess(
  normalizePlatform,
  z.enum(['android', 'windows', 'linux']),
)

export const statusEnum = z.enum(['active', 'new', 'beta', 'deprecated', 'archived'])

export const sortEnum = z.enum(['updated', 'name', 'created'])

export const applicationCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const iconKeySchema = z.enum([
  'auto',
  'monitor',
  'smartphone',
  'tablet',
  'heart-pulse',
  'stethoscope',
  'shield',
  'package',
  'radio',
  'building',
  'activity',
  'settings',
])

export const iconColorSchema = z.enum([
  'auto',
  'mint',
  'blue',
  'violet',
  'rose',
  'amber',
  'orange',
  'slate',
  'cyan',
  'lime',
])

export const createSchema = z.object({
  name: z.string().min(1).max(200),
  applicationCode: applicationCodeSchema,
  description: z.string().min(1).max(4000),
  packageName: z.string().min(1).max(255),
  platform: platformEnum,
  regionId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  repository: z.string().max(500).optional(),
})

export const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  applicationCode: applicationCodeSchema.optional(),
  iconKey: iconKeySchema.optional(),
  iconColor: iconColorSchema.optional(),
  description: z.string().min(1).max(4000).optional(),
  packageName: z.string().min(1).max(255).optional(),
  platform: platformEnum.optional(),
  regionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  repository: z.string().max(500).optional(),
  status: statusEnum.optional(),
  ownerName: z.string().max(120).optional(),
})

export const bulkApplicationCodesSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        applicationCode: applicationCodeSchema,
      }),
    )
    .min(1)
    .max(200),
})

export const bulkApplicationAppearanceSchema = z
  .object({
    applicationIds: z.array(z.string().uuid()).min(1).max(200),
    iconKey: iconKeySchema.optional(),
    iconColor: iconColorSchema.optional(),
  })
  .refine((value) => value.iconKey !== undefined || value.iconColor !== undefined, {
    message: 'At least one appearance field is required',
  })

export async function projectNameFor(id: string) {
  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1)
  return project?.name
}

export const memberRoleSchema = z.object({ role: z.enum(['maintainer', 'viewer']) })
