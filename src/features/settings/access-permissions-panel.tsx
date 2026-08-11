import { Loader2, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import {
  apiBatchUpdateApplicationAccess,
  apiListApplicationAccess,
  apiListApplications,
  apiListUsers,
  type TeamMemberDto,
} from '@/services/api'
import {
  AccessPermissionsWorkspace,
  AdminAccessNotice,
} from './access-permissions-workspace'
import { SettingsPanel } from './settings-panel'

export function AccessPermissionsPanel({
  isAdmin,
  hideHeader = false,
}: {
  isAdmin: boolean
  hideHeader?: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const usersQuery = useQuery({
    queryKey: queryKeys.users.list,
    queryFn: apiListUsers,
    enabled: isAdmin,
  })
  const applicationsQuery = useQuery({
    queryKey: queryKeys.applications.list({ sort: 'name' }),
    queryFn: () => apiListApplications({ sort: 'name' }),
    enabled: isAdmin,
  })

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const applications = useMemo(
    () => applicationsQuery.data ?? [],
    [applicationsQuery.data],
  )
  // 首次加载没有显式选择时，稳定地回退到第一个非管理员账户。
  const selectedUser =
    users.find((user) => user.id === selectedUserId) ??
    users.find((user) => user.role !== 'admin') ??
    users[0]
  const grantsQuery = useQuery({
    queryKey: queryKeys.accessGrants.byUser(selectedUser?.id ?? ''),
    queryFn: () => apiListApplicationAccess(selectedUser!.id),
    enabled: isAdmin && Boolean(selectedUser) && selectedUser?.role !== 'admin',
  })

  const saveAccess = async (input: {
    operation: 'set' | 'remove'
    applicationIds: string[]
    role: 'maintainer' | 'viewer'
  }) => {
    if (!selectedUser) return false
    setSaving(true)
    try {
      await apiBatchUpdateApplicationAccess(
        input.operation === 'set'
          ? { ...input, userId: selectedUser.id }
          : {
              operation: input.operation,
              applicationIds: input.applicationIds,
              userId: selectedUser.id,
            },
      )
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.accessGrants.byUser(selectedUser.id),
        }),
        queryClient.invalidateQueries({ queryKey: ['application-members'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
      ])
      toast.success(
        input.operation === 'set'
          ? t('access.updated', { count: input.applicationIds.length })
          : t('access.removed', { count: input.applicationIds.length }),
      )
      return true
    } catch (error) {
      toast.error(
        getRequestErrorMessage(error, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('access.saveFailed'),
        }),
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsPanel
      title={t('access.title')}
      description={t('access.description')}
      wide
      hideHeader={hideHeader}
    >
      {!isAdmin ? (
        <EmptyAccessState title={t('access.adminOnly')} />
      ) : usersQuery.isLoading || applicationsQuery.isLoading ? (
        <LoadingAccessState />
      ) : usersQuery.isError || applicationsQuery.isError ? (
        <EmptyAccessState title={t('access.loadFailed')} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(15rem,0.34fr)_minmax(0,1fr)]">
          <UserList
            users={users}
            selectedUserId={selectedUser?.id}
            onSelect={(userId) => setSelectedUserId(userId)}
          />
          <section className="min-w-0 rounded-2xl bg-card/65 ring-1 ring-border/70">
            {!selectedUser ? (
              <EmptyAccessState title={t('access.noUsers')} />
            ) : selectedUser.role === 'admin' ? (
              <AdminAccessNotice />
            ) : grantsQuery.isLoading ? (
              <LoadingAccessState />
            ) : grantsQuery.isError ? (
              <EmptyAccessState title={t('access.loadFailed')} />
            ) : (
              <AccessPermissionsWorkspace
                key={selectedUser.id}
                user={selectedUser}
                applications={applications}
                grants={grantsQuery.data ?? []}
                saving={saving}
                onApply={saveAccess}
              />
            )}
          </section>
        </div>
      )}
    </SettingsPanel>
  )
}

function UserList({
  users,
  selectedUserId,
  onSelect,
}: {
  users: TeamMemberDto[]
  selectedUserId?: string
  onSelect: (userId: string) => void
}) {
  const { t } = useTranslation()
  return (
    <aside className="rounded-2xl bg-muted/20 p-3 ring-1 ring-border/60 dark:bg-muted/10">
      <div className="px-1 pb-3">
        <p className="text-[0.75rem] font-medium text-foreground">{t('access.people')}</p>
        <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {t('access.peopleHint')}
        </p>
      </div>
      <div className="space-y-1">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
              selectedUserId === user.id
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            }`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserRound className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium">
                {user.name}
              </span>
              <span className="block truncate text-[0.6875rem] text-muted-foreground">
                {user.email}
              </span>
            </span>
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {t(`access.platformRole.${user.role}`)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function LoadingAccessState() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-56 items-center justify-center gap-2 text-[0.8125rem] text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {t('common.loading')}
    </div>
  )
}

function EmptyAccessState({ title }: { title: string }) {
  return (
    <p className="rounded-2xl bg-muted/20 px-5 py-12 text-center text-[0.8125rem] text-muted-foreground">
      {title}
    </p>
  )
}
