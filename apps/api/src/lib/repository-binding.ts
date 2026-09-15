import { z } from 'zod'

/** Transport and SSH user are irrelevant; repository path remains case sensitive. */
export function normalizeRepository(value: string): string {
  const input = value.trim()
  const scp = input.match(/^(?:[^@/\s]+@)?([^/:\s]+):([^/].*)$/)
  const url = new URL(!input.includes('://') && scp ? `ssh://${scp[1]}/${scp[2]}` : input)
  if (
    !['https:', 'http:', 'ssh:'].includes(url.protocol) ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Use a repository clone URL without credentials, query or fragment')
  }
  if (url.protocol !== 'ssh:' && url.username)
    throw new Error('Credentials are not allowed')
  const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '')
  if (!path || path === '/') throw new Error('Repository path is required')
  return `${url.host.toLowerCase()}${path}`
}

export const repositoryBindingSchema = z.object({
  repository: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => {
      try {
        normalizeRepository(value)
        return true
      } catch {
        return false
      }
    }, 'Use an HTTPS or SSH repository clone URL'),
  branch: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine(
      (value) =>
        !/[\s~^:?*[\\]/.test(value) &&
        !value.includes('..') &&
        !value.includes('@{') &&
        !value.startsWith('-') &&
        !value.startsWith('/') &&
        !value.endsWith('/') &&
        value !== 'HEAD',
      'Use an exact branch name',
    ),
  directory: z
    .string()
    .trim()
    .max(500)
    .default('')
    .transform((value) =>
      value === '.' ? '' : value.replace(/\\/g, '/').replace(/\/$/, ''),
    )
    .refine(
      (value) =>
        !value.startsWith('/') &&
        !value.includes(':') &&
        !value.split('/').some((part) => part === '..' || part === '.') &&
        !Array.from(value).some((character) => character.charCodeAt(0) < 32),
      'Use a repository-relative directory',
    ),
})

export const repositoryBindingsSchema = z
  .array(repositoryBindingSchema)
  .max(20)
  .refine((values) => {
    try {
      const keys = values.map((value) =>
        JSON.stringify([
          normalizeRepository(value.repository),
          value.branch,
          value.directory,
        ]),
      )
      return new Set(keys).size === keys.length
    } catch {
      return false
    }
  }, 'Duplicate repository binding')

  .transform((values) =>
    values.map((value) => ({
      ...value,
      repositoryKey: normalizeRepository(value.repository),
    })),
  )
