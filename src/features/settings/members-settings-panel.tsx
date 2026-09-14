import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CreateMemberDialog } from './create-member-dialog'
import { getMemberErrorMessage } from './member-error'
import { ResetMemberPasswordForm } from './reset-member-password-form'
import { TransferAdministratorDialog } from './transfer-administrator-dialog'

import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/common/user-avatar'
import { Input } from '@/components/ui/input'
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import {
  apiDeleteUser,
  apiListUsers,
  apiUpdateUser,
  type TeamMemberDto,
} from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import { MEMBER_ROLES, type MemberRole } from './member-roles'
import { SettingsPanel } from './settings-panel'

const PAGE_SIZE = 10

type RoleChangeConfirmation = {
  id: string
  name: string
  nextRole: MemberRole
} | null

export function MembersSettingsPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  const isAdmin = user?.role === 'admin'
  const membersQuery = useQuery({
    queryKey: queryKeys.users.list,
    queryFn: apiListUsers,
    enabled: isAdmin,
  })
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<MemberRole | 'all'>('all')
  const [page, setPage] = useState(1)

  const [removeId, setRemoveId] = useState<string | null>(null)
  const [resetId, setResetId] = useState<string | null>(null)

  const [roleChangeConfirmation, setRoleChangeConfirmation] =
    useState<RoleChangeConfirmation>(null)

  const roleLabel = (value: MemberRole) => t(`settings.role.${value}`)
  const errorMessage = (error: unknown) => getMemberErrorMessage(error, t)
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return members.filter(
      (member) =>
        (!query ||
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query) ||
          member.username?.toLowerCase().includes(query)) &&
        (roleFilter === 'all' || member.role === roleFilter),
    )
  }, [members, roleFilter, search])
  const transferCandidates = useMemo(
    () => members.filter((member) => member.id !== user?.id),
    [members, user?.id],
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(
    (Math.min(page, totalPages) - 1) * PAGE_SIZE,
    Math.min(page, totalPages) * PAGE_SIZE,
  )

  const changeRole = async (id: string, nextRole: MemberRole, memberName: string) => {
    try {
      await apiUpdateUser(id, { role: nextRole })
      await invalidate()
      toast.success(t('settings.roleUpdated'), {
        description: t('settings.roleUpdatedDesc', {
          name: memberName,
          role: roleLabel(nextRole),
        }),
      })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  const requestRoleChange = (member: TeamMemberDto, nextRole: MemberRole) => {
    if (member.role === 'admin' && nextRole !== 'admin') {
      setRoleChangeConfirmation({ id: member.id, name: member.name, nextRole })
      return
    }
    void changeRole(member.id, nextRole, member.name)
  }

  const removeMember = async (id: string, memberName: string) => {
    setRemoveId(null)
    try {
      await apiDeleteUser(id)
      await invalidate()
      toast.success(t('settings.memberRemoved'), { description: memberName })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <SettingsPanel
      title={t('settings.membersTitle')}
      description={t('settings.membersDesc')}
      wide
      hideHeader={hideHeader}
    >
      <div className="mb-4 space-y-2.5 rounded-2xl bg-muted/25 p-4 ring-1 ring-border/60 dark:bg-muted/15">
        <p className="text-[0.75rem] font-medium text-foreground">
          {t('settings.roleLegendTitle')}
        </p>
        <ul className="space-y-2">
          {MEMBER_ROLES.map((item) => (
            <li
              key={item}
              className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <span className="shrink-0 text-[0.8125rem] font-medium text-foreground sm:w-20">
                {roleLabel(item)}
              </span>
              <span className="text-[0.75rem] leading-relaxed text-muted-foreground">
                {t(`settings.roleDesc.${item}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {!isAdmin ? (
        <p className="rounded-2xl bg-muted/25 px-4 py-6 text-center text-[0.875rem] text-muted-foreground ring-1 ring-border/60">
          {t('settings.membersAdminOnly')}
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={t('settings.memberSearchPlaceholder')}
                className="h-9 rounded-lg pl-9"
              />
            </div>
            <div className="flex rounded-lg bg-muted/40 p-0.5" role="group">
              {(['all', ...MEMBER_ROLES] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={roleFilter === item}
                  onClick={() => {
                    setRoleFilter(item)
                    setPage(1)
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-[0.6875rem] font-medium transition-colors',
                    roleFilter === item
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item === 'all' ? t('common.all') : roleLabel(item)}
                </button>
              ))}
            </div>
            <CreateMemberDialog />
          </div>
          <p className="mb-3 text-[0.75rem] text-muted-foreground">
            {t('settings.memberFilteredCount', {
              count: filtered.length,
              total: members.length,
            })}
          </p>

          {membersQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>{t('common.loading')}</span>
            </div>
          ) : membersQuery.isError ? (
            <p className="py-6 text-center text-muted-foreground">
              {t('settings.memberErrorGeneric')}
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-xl bg-muted/20 py-10 text-center text-muted-foreground">
              {t('settings.noMemberMatches')}
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl ring-1 ring-border/70">
              {visible.map((member) => {
                const isSelf = user?.id === member.id
                return (
                  <li key={member.id} className="space-y-3 bg-card/40 px-4 py-3.5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          user={member}
                          className="size-9 shrink-0"
                          fallbackClassName="text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[0.875rem] font-medium">
                            {member.name}
                            {isSelf ? (
                              <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
                                {t('settings.you')}
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[0.75rem] text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isSelf ? (
                          <>
                            <span className="rounded-md bg-foreground px-2.5 py-1 text-[0.75rem] font-medium text-background">
                              {roleLabel(member.role)}
                            </span>
                            {member.role === 'admin' ? (
                              <TransferAdministratorDialog
                                transferCandidates={transferCandidates}
                              />
                            ) : null}
                          </>
                        ) : (
                          <div className="flex gap-1" role="group">
                            {MEMBER_ROLES.map((item) => (
                              <button
                                key={item}
                                type="button"
                                aria-pressed={member.role === item}
                                onClick={() =>
                                  member.role !== item && requestRoleChange(member, item)
                                }
                                className={cn(
                                  'rounded-md px-2.5 py-1 text-[0.75rem] font-medium',
                                  member.role === item
                                    ? 'bg-foreground text-background'
                                    : 'bg-muted/40 text-muted-foreground',
                                )}
                              >
                                {roleLabel(item)}
                              </button>
                            ))}
                          </div>
                        )}
                        {!isSelf ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t('settings.resetPasswordTitle', {
                              name: member.name,
                            })}
                            onClick={() => {
                              setResetId(resetId === member.id ? null : member.id)
                            }}
                          >
                            <KeyRound className="size-3.5" />
                          </Button>
                        ) : null}
                        {removeId === member.id ? (
                          <>
                            <span className="text-[0.75rem] text-muted-foreground">
                              {t('settings.removeConfirm')}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-destructive text-white"
                              onClick={() => void removeMember(member.id, member.name)}
                            >
                              {t('settings.confirmRemove')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setRemoveId(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isSelf}
                            onClick={() => setRemoveId(member.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {resetId === member.id ? (
                      <ResetMemberPasswordForm
                        member={member}
                        onClose={() =>
                          setResetId((current) =>
                            current === member.id ? null : current,
                          )
                        }
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          {totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-2">
              <span className="text-[0.75rem] tabular-nums text-muted-foreground">
                {t('common.pageOf', {
                  page: Math.min(page, totalPages),
                  total: totalPages,
                })}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          ) : null}
          <Modal
            open={Boolean(roleChangeConfirmation)}
            onOpenChange={(open) => !open && setRoleChangeConfirmation(null)}
          >
            <ModalContent>
              <ModalHeader>
                <ModalTitle>{t('settings.confirmAdminDemotionTitle')}</ModalTitle>
                <ModalDescription>
                  {t('settings.confirmAdminDemotionDesc', {
                    name: roleChangeConfirmation?.name ?? '',
                    role: roleLabel(roleChangeConfirmation?.nextRole ?? 'viewer'),
                  })}
                </ModalDescription>
              </ModalHeader>
              <ModalFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRoleChangeConfirmation(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    const pending = roleChangeConfirmation
                    setRoleChangeConfirmation(null)
                    if (pending)
                      void changeRole(pending.id, pending.nextRole, pending.name)
                  }}
                >
                  {t('settings.confirmAdminDemotion')}
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <p className="mt-3 text-[0.75rem] text-muted-foreground">
            {t('settings.membersHint')}
          </p>
        </>
      )}
    </SettingsPanel>
  )
}
