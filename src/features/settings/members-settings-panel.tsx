import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormError } from '@/components/feedback'
import { UserAvatar } from '@/components/common/user-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { checkPassword } from '@/lib/password'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { ApiError, isConnectivityError } from '@/services/http'
import {
  apiAdminResetPassword,
  apiCreateUser,
  apiDeleteUser,
  apiListUsers,
  apiTransferAdministrator,
  apiUpdateUser,
  type TeamMemberDto,
} from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import { MEMBER_ROLES, type MemberRole } from './mock-members'
import { PasswordField } from './password-field'
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
  const logout = useAuthStore((state) => state.logout)
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
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [roleChangeConfirmation, setRoleChangeConfirmation] =
    useState<RoleChangeConfirmation>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferRole, setTransferRole] = useState<'maintainer' | 'viewer'>('viewer')
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferring, setTransferring] = useState(false)

  const roleLabel = (value: MemberRole) => t(`settings.role.${value}`)
  const errorMessage = (error: unknown) => {
    if (isConnectivityError(error))
      return getRequestErrorMessage(error, {
        offline: t('common.requestFailedOffline'),
        unavailable: t('common.requestFailedUnavailable'),
        fallback: t('settings.memberErrorGeneric'),
      })
    if (error instanceof ApiError) {
      const key = {
        email_taken: 'settings.memberErrorDuplicate',
        username_taken: 'settings.memberErrorDuplicate',
        last_admin: 'settings.memberErrorLastAdmin',
        cannot_delete_self: 'settings.memberErrorSelfDelete',
        self_role_change_requires_transfer: 'settings.memberErrorSelfRoleChange',
        transfer_target_not_found: 'settings.memberErrorTransferTarget',
        transfer_target_inactive: 'settings.memberErrorTransferTargetInactive',
        weak_password: 'settings.passwordErrorWeak',
        not_found: 'settings.memberErrorNotFound',
        forbidden: 'settings.resetForbidden',
        invalid_body: 'settings.memberErrorEmpty',
      }[error.code]
      return key ? t(key) : error.message || t('settings.memberErrorGeneric')
    }
    return t('settings.memberErrorGeneric')
  }
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
  const createMember = async () => {
    setCreateError(null)
    if (!name.trim() || !username.trim() || !email.trim() || !password)
      return setCreateError(t('settings.memberErrorEmptyFields'))
    if (password !== passwordConfirm)
      return setCreateError(t('settings.passwordErrorMismatch'))
    if (!checkPassword(password, { confirm: passwordConfirm }).ok)
      return setCreateError(t('settings.passwordErrorWeak'))
    setCreating(true)
    try {
      const member = await apiCreateUser({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      })
      await invalidate()
      toast.success(t('settings.memberAdded'), {
        description: t('settings.memberAddedDesc', {
          name: member.name,
          role: roleLabel(member.role),
        }),
      })
      setName('')
      setUsername('')
      setEmail('')
      setPassword('')
      setPasswordConfirm('')
      setRole('viewer')
      setShowCreate(false)
    } catch (error) {
      setCreateError(errorMessage(error))
    } finally {
      setCreating(false)
    }
  }

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
  const transferAdministrator = async () => {
    if (!transferTargetId) {
      setTransferError(t('settings.memberErrorTransferTarget'))
      return
    }
    setTransferError(null)
    setTransferring(true)
    try {
      const target = transferCandidates.find((member) => member.id === transferTargetId)
      await apiTransferAdministrator({
        targetUserId: transferTargetId,
        nextRole: transferRole,
      })
      toast.success(t('settings.adminTransferred'), {
        description: t('settings.adminTransferredDesc', { name: target?.name ?? '' }),
      })
      logout()
    } catch (error) {
      setTransferError(errorMessage(error))
    } finally {
      setTransferring(false)
    }
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
  const resetMemberPassword = async (id: string, memberName: string) => {
    setResetError(null)
    if (!resetPassword || !resetConfirm)
      return setResetError(t('settings.passwordErrorEmpty'))
    if (resetPassword !== resetConfirm)
      return setResetError(t('settings.passwordErrorMismatch'))
    if (!checkPassword(resetPassword, { confirm: resetConfirm }).ok)
      return setResetError(t('settings.passwordErrorWeak'))
    setResetting(true)
    try {
      await apiAdminResetPassword(id, resetPassword)
      setResetId(null)
      setResetPassword('')
      setResetConfirm('')
      toast.success(t('settings.passwordReset'), {
        description: t('settings.passwordResetDesc', { name: memberName }),
      })
    } catch (error) {
      setResetError(errorMessage(error))
    } finally {
      setResetting(false)
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
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setShowCreate(true)
                setCreateError(null)
              }}
            >
              <Plus className="size-3.5" />
              {t('settings.addMember')}
            </Button>
          </div>
          <p className="mb-3 text-[0.75rem] text-muted-foreground">
            {t('settings.memberFilteredCount', {
              count: filtered.length,
              total: members.length,
            })}
          </p>
          <Modal open={showCreate} onOpenChange={setShowCreate}>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>{t('settings.addMemberTitle')}</ModalTitle>
                <ModalDescription>{t('settings.addMemberHint')}</ModalDescription>
              </ModalHeader>
              <ModalBody className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    [t('settings.fieldName'), name, setName, 'name'],
                    [t('settings.fieldUsername'), username, setUsername, 'username'],
                    [t('settings.fieldEmail'), email, setEmail, 'email'],
                  ].map(([label, value, setter, autocomplete]) => (
                    <label key={label as string} className="block space-y-1.5">
                      <span className="text-[0.75rem] font-medium text-foreground">
                        {label as string}
                      </span>
                      <Input
                        value={value as string}
                        onChange={(event) =>
                          (setter as (value: string) => void)(event.target.value)
                        }
                        disabled={creating}
                        autoComplete={autocomplete as string}
                      />
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PasswordField
                    id="member-password"
                    label={t('settings.fieldTempPassword')}
                    value={password}
                    onChange={setPassword}
                    disabled={creating}
                    showStrength
                    confirm={passwordConfirm}
                  />
                  <PasswordField
                    id="member-password-confirm"
                    label={t('settings.fieldTempConfirm')}
                    value={passwordConfirm}
                    onChange={setPasswordConfirm}
                    disabled={creating}
                    matchAgainst={password}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {MEMBER_ROLES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-[0.75rem]',
                        role === item
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground',
                      )}
                      onClick={() => setRole(item)}
                    >
                      {roleLabel(item)}
                    </button>
                  ))}
                </div>
                <FormError message={createError} />
              </ModalBody>
              <ModalFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={creating}
                  onClick={() => setShowCreate(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  disabled={creating}
                  onClick={() => void createMember()}
                >
                  {creating ? t('settings.addingMember') : t('settings.confirmAddMember')}
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                      <div className="flex flex-wrap items-center gap-2">
                        {isSelf ? (
                          <>
                            <span className="rounded-md bg-foreground px-2.5 py-1 text-[0.75rem] font-medium text-background">
                              {roleLabel(member.role)}
                            </span>
                            {member.role === 'admin' ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={transferCandidates.length === 0}
                                title={
                                  transferCandidates.length === 0
                                    ? t('settings.transferAdminNoCandidate')
                                    : undefined
                                }
                                onClick={() => {
                                  setTransferTargetId(transferCandidates[0]?.id ?? '')
                                  setTransferRole('viewer')
                                  setTransferError(null)
                                  setTransferOpen(true)
                                }}
                              >
                                <ArrowRightLeft className="size-3.5" />
                                {t('settings.transferAdmin')}
                              </Button>
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
                            onClick={() => {
                              setResetId(resetId === member.id ? null : member.id)
                              setResetPassword('')
                              setResetConfirm('')
                              setResetError(null)
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
                      <div className="space-y-3 rounded-xl bg-muted/25 p-4 ring-1 ring-border/60">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <PasswordField
                            id={`reset-${member.id}`}
                            label={t('settings.fieldTempPassword')}
                            value={resetPassword}
                            onChange={setResetPassword}
                            disabled={resetting}
                            showStrength
                            confirm={resetConfirm}
                          />
                          <PasswordField
                            id={`reset-confirm-${member.id}`}
                            label={t('settings.fieldTempConfirm')}
                            value={resetConfirm}
                            onChange={setResetConfirm}
                            disabled={resetting}
                            matchAgainst={resetPassword}
                          />
                        </div>
                        <FormError message={resetError} />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setResetId(null)}
                          >
                            {t('common.cancel')}
                          </Button>
                          <Button
                            type="button"
                            disabled={resetting || !resetPassword || !resetConfirm}
                            onClick={() =>
                              void resetMemberPassword(member.id, member.name)
                            }
                          >
                            {resetting
                              ? t('settings.resettingPassword')
                              : t('settings.confirmResetPassword')}
                          </Button>
                        </div>
                      </div>
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
          <Modal open={transferOpen} onOpenChange={setTransferOpen}>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>{t('settings.transferAdminTitle')}</ModalTitle>
                <ModalDescription>{t('settings.transferAdminDesc')}</ModalDescription>
              </ModalHeader>
              <ModalBody className="space-y-5">
                <label className="block space-y-1.5">
                  <span className="text-[0.8125rem] font-medium text-foreground">
                    {t('settings.transferAdminTarget')}
                  </span>
                  <Select
                    value={transferTargetId}
                    disabled={transferring}
                    onValueChange={setTransferTargetId}
                  >
                    <SelectTrigger
                      aria-label={t('settings.transferAdminTarget')}
                      className="h-12 bg-background px-3 text-[0.875rem]"
                    >
                      <SelectValue
                        placeholder={t('settings.transferAdminTargetPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent sideOffset={6}>
                      {transferCandidates.map((member) => (
                        <SelectItem
                          key={member.id}
                          value={member.id}
                          className="h-auto py-2 pr-8"
                        >
                          <span className="flex items-center gap-2.5">
                            <UserAvatar
                              user={member}
                              className="size-7 shrink-0"
                              fallbackClassName="text-[0.625rem]"
                            />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-[0.8125rem] font-medium">
                                {member.name}
                              </span>
                              <span className="truncate text-[0.6875rem] text-muted-foreground">
                                {member.email}
                              </span>
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <div className="space-y-1.5">
                  <p className="text-[0.8125rem] font-medium text-foreground">
                    {t('settings.transferAdminYourNextRole')}
                  </p>
                  <div className="grid grid-cols-2 gap-2" role="group">
                    {(['maintainer', 'viewer'] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        disabled={transferring}
                        aria-pressed={transferRole === item}
                        onClick={() => setTransferRole(item)}
                        className={cn(
                          'rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors',
                          transferRole === item
                            ? 'bg-foreground text-background'
                            : 'bg-muted/40 text-muted-foreground hover:bg-muted/65 hover:text-foreground',
                        )}
                      >
                        {roleLabel(item)}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-foreground">
                  {t('settings.transferAdminWarning')}
                </p>
                <FormError message={transferError} />
              </ModalBody>
              <ModalFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={transferring}
                  onClick={() => setTransferOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={transferring || !transferTargetId}
                  onClick={() => void transferAdministrator()}
                >
                  {transferring
                    ? t('settings.transferringAdmin')
                    : t('settings.confirmTransferAdmin')}
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
