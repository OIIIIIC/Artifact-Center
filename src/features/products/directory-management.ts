import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { queryKeys } from '@/lib/query-keys'
import { getConnectivityStatusForError } from '@/services/http'

const mutationKey = ['directory-management'] as const

export function useDirectoryMutation() {
  const client = useQueryClient()
  const busy = useIsMutating({ mutationKey }) > 0
  const mutation = useMutation({
    mutationKey,
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSettled: async () => {
      // 名称和归属同时出现在目录、应用卡片及个人工作台中。
      await Promise.all(
        [
          queryKeys.regions.all,
          queryKeys.projects,
          queryKeys.applications.all,
          queryKeys.personalWorkspace,
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      )
    },
  })
  return { ...mutation, busy }
}

export function directoryError(error: unknown, t: TFunction): string {
  const code = (error as { code?: string } | null)?.code
  const keys: Record<string, string> = {
    project_taken: 'directory.duplicate',
    region_taken: 'directory.productDuplicate',
    project_in_use: 'directory.inUse',
    region_in_use: 'directory.productInUse',
    default_project_required: 'directory.defaultProtected',
    project_order_changed: 'directory.orderChanged',
    project_unavailable: 'directory.unavailable',
    region_unavailable: 'directory.productDisabled',
    not_found: 'directory.unavailable',
    invalid_body: 'directory.invalidInput',
  }
  const connectivity = getConnectivityStatusForError(error)
  if (connectivity === 'offline') return t('common.requestFailedOffline')
  if (connectivity === 'unavailable') return t('common.requestFailedUnavailable')
  return t(keys[code ?? ''] ?? 'directory.saveFailed')
}
