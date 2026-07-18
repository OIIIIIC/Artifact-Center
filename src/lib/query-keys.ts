import type { ListApplicationsParams } from '@/services/api'

export const queryKeys = {
  applications: {
    all: ['applications'] as const,
    list: (params: ListApplicationsParams = {}) =>
      ['applications', 'list', params] as const,
    detail: (id: string) => ['applications', 'detail', id] as const,
  },
  artifacts: {
    byApp: (appId: string) => ['artifacts', 'byApp', appId] as const,
    detail: (id: string) => ['artifacts', 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    list: ['users', 'list'] as const,
  },
  audit: {
    all: ['audit'] as const,
    byApp: (appId: string) => ['audit', 'app', appId] as const,
    global: ['audit', 'global'] as const,
  },
  me: ['auth', 'me'] as const,
}
