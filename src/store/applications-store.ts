import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { MOCK_APPLICATIONS } from '@/mocks/applications'
import type {
  Application,
  ApplicationPlatform,
  ApplicationStatus,
} from '@/types/application'

export type CreateApplicationInput = {
  name: string
  description: string
  packageName: string
  platform: ApplicationPlatform
  repository?: string
  owner?: string
}

export type UpdateApplicationInput = {
  name?: string
  description?: string
  packageName?: string
  platform?: ApplicationPlatform
  repository?: string
  owner?: string
  status?: ApplicationStatus
}

interface ApplicationsState {
  /** User-created apps (seed mocks stay in MOCK_APPLICATIONS) */
  created: Application[]
  /** Field patches for seed (or any) apps */
  overrides: Record<string, Partial<Application>>
  /** Soft-deleted ids (hidden from catalog) */
  deletedIds: string[]
  createApplication: (input: CreateApplicationInput) => Application
  updateApplication: (
    id: string,
    input: UpdateApplicationInput,
  ) =>
    { ok: true; application: Application } | { ok: false; code: 'not_found' | 'invalid' }
  deleteApplication: (id: string) => { ok: true } | { ok: false; code: 'not_found' }
  /** After a successful artifact publish — bump version / count / updatedAt */
  recordPublish: (id: string, meta: { version: string; markLatest?: boolean }) => void
  getCatalog: () => Application[]
  getById: (id: string) => Application | undefined
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function applyOverride(app: Application, override?: Partial<Application>): Application {
  if (!override) return app
  return { ...app, ...override, id: app.id }
}

export const useApplicationsStore = create<ApplicationsState>()(
  persist(
    (set, get) => ({
      created: [],
      overrides: {},
      deletedIds: [],
      getCatalog: () => {
        const { created, overrides, deletedIds } = get()
        const deleted = new Set(deletedIds)
        const createdIds = new Set(created.map((a) => a.id))
        const base = [
          ...created,
          ...MOCK_APPLICATIONS.filter((a) => !createdIds.has(a.id)),
        ].filter((a) => !deleted.has(a.id))
        return base.map((a) => applyOverride(a, overrides[a.id]))
      },
      getById: (id) =>
        get()
          .getCatalog()
          .find((a) => a.id === id),
      createApplication: (input) => {
        const now = new Date().toISOString()
        const base = slugify(input.name) || 'app'
        const id = `app-${base}-${Date.now().toString(36)}`
        const app: Application = {
          id,
          name: input.name.trim(),
          description: input.description.trim(),
          packageName: input.packageName.trim(),
          platform: input.platform,
          repository: input.repository?.trim() || `git.enterprise.local/${base}`,
          /** Empty until first artifact is published */
          latestVersion: '',
          updatedAt: now,
          createdAt: now,
          owner: input.owner?.trim() || 'Demo User',
          artifactCount: 0,
          status: 'new',
        }
        set((s) => ({ created: [app, ...s.created] }))
        return app
      },
      updateApplication: (id, input) => {
        const current = get().getById(id)
        if (!current) return { ok: false, code: 'not_found' }

        const name = input.name?.trim()
        const description = input.description?.trim()
        const packageName = input.packageName?.trim()
        const repository = input.repository?.trim()
        const owner = input.owner?.trim()

        if (
          (input.name !== undefined && !name) ||
          (input.description !== undefined && !description) ||
          (input.packageName !== undefined && !packageName)
        ) {
          return { ok: false, code: 'invalid' }
        }

        const patch: Partial<Application> = {
          updatedAt: new Date().toISOString(),
        }
        if (name !== undefined) patch.name = name
        if (description !== undefined) patch.description = description
        if (packageName !== undefined) patch.packageName = packageName
        if (input.platform !== undefined) patch.platform = input.platform
        if (repository !== undefined) patch.repository = repository
        if (owner !== undefined) patch.owner = owner
        if (input.status !== undefined) patch.status = input.status

        const inCreated = get().created.some((a) => a.id === id)
        if (inCreated) {
          set((s) => ({
            created: s.created.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          }))
        } else {
          set((s) => ({
            overrides: {
              ...s.overrides,
              [id]: { ...s.overrides[id], ...patch },
            },
          }))
        }

        const application = get().getById(id)
        if (!application) return { ok: false, code: 'not_found' }
        return { ok: true, application }
      },
      deleteApplication: (id) => {
        const current = get().getById(id)
        if (!current && !get().deletedIds.includes(id)) {
          // already gone
          const wasCreated = get().created.some((a) => a.id === id)
          if (!wasCreated && !get().overrides[id]) {
            return { ok: false, code: 'not_found' }
          }
        }
        if (!get().getById(id) && !get().created.some((a) => a.id === id)) {
          // Check raw seed existence
          const seed = MOCK_APPLICATIONS.some((a) => a.id === id)
          if (!seed && !get().created.some((a) => a.id === id)) {
            return { ok: false, code: 'not_found' }
          }
        }

        set((s) => {
          const { [id]: _removed, ...restOverrides } = s.overrides
          return {
            created: s.created.filter((a) => a.id !== id),
            overrides: restOverrides,
            deletedIds: s.deletedIds.includes(id) ? s.deletedIds : [...s.deletedIds, id],
          }
        })
        return { ok: true }
      },
      recordPublish: (id, meta) => {
        const current = get().getById(id)
        if (!current) return
        const now = new Date().toISOString()
        const patch: Partial<Application> = {
          updatedAt: now,
          artifactCount: current.artifactCount + 1,
        }
        if (meta.markLatest !== false && meta.version.trim()) {
          patch.latestVersion = meta.version.trim()
          if (current.status === 'new') patch.status = 'active'
        }
        const inCreated = get().created.some((a) => a.id === id)
        if (inCreated) {
          set((s) => ({
            created: s.created.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          }))
        } else {
          set((s) => ({
            overrides: {
              ...s.overrides,
              [id]: { ...s.overrides[id], ...patch },
            },
          }))
        }
      },
    }),
    {
      name: 'artifact-center-applications',
      partialize: (s) => ({
        created: s.created,
        overrides: s.overrides,
        deletedIds: s.deletedIds,
      }),
    },
  ),
)
