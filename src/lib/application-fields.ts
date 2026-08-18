export const APPLICATION_FIELD_LIMITS = {
  name: 200,
  applicationCode: 48,
  description: 4000,
  packageName: 255,
  repository: 500,
  owner: 120,
} as const

export type ApplicationEditableField = keyof typeof APPLICATION_FIELD_LIMITS
