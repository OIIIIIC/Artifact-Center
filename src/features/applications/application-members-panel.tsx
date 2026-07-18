import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import {
  apiListApplicationMemberCandidates,
  apiListApplicationMembers,
  apiRemoveApplicationMember,
  apiUpsertApplicationMember,
  type ApplicationMemberCandidateDto,
  type ApplicationMemberDto,
} from '@/services/api'

type ApplicationMemberRole = ApplicationMemberDto['role']
type RoleFilter = 'all' | ApplicationMemberRole

const PAGE_SIZE = 10

interface ApplicationMembersPanelProps {
  applicationId: string
  autoOpen?: boolean
}

export function ApplicationMembersPanel({
  applicationId,
  autoOpen = false,
}: ApplicationMembersPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [addingOpen, setAddingOpen] = useState(autoOpen)
  const [candidateSearch, setCandidateSearch] = useState('')
  const deferredCandidateSearch = useDeferredValue(candidateSearch)
  const [memberSearch, setMemberSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [page, setPage] = useState(1)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)

  const membersQuery = useQuery({
    queryKey: queryKeys.applicationMembers.byApp(applicationId),
    queryFn: () => apiListApplicationMembers(applicationId),
  })
  const candidatesQuery = useQuery({
    queryKey: queryKeys.applicationMembers.candidates(
      applicationId,
      deferredCandidateSearch,
    ),
    queryFn: () =>
      apiListApplicationMemberCandidates(applicationId, deferredCandidateSearch),
    enabled: addingOpen,
  })

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    return members.filter((member) => {
      const matchesQuery =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
      return matchesQuery && (roleFilter === 'all' || member.role === roleFilter)
    })
  }, [memberSearch, members, roleFilter])
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE))
  const effectivePage = Math.min(page, totalPages)
  const visibleMembers = filteredMembers.slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  )

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicationMembers.byApp(applicationId),
      }),
      queryClient.invalidateQueries({
        queryKey: ['application-members', applicationId, 'candidates'],
      }),
    ])
  }

  const addMember = async (
    candidate: ApplicationMemberCandidateDto,
    role: ApplicationMemberRole,
  ) => {
    setPendingId(candidate.id)
    try {
      await apiUpsertApplicationMember(applicationId, candidate.id, role)
      await refresh()
      toast.success(t('appMembers.added'), { description: candidate.name })
    } catch {
      toast.error(t('appMembers.saveFailed'))
    } finally {
      setPendingId(null)
    }
  }

  const updateRole = async (
    member: ApplicationMemberDto,
    role: ApplicationMemberRole,
  ) => {
    if (member.role === role) return
    setPendingId(member.id)
    try {
      await apiUpsertApplicationMember(applicationId, member.id, role)
      await refresh()
      toast.success(t('appMembers.roleUpdated'), { description: member.name })
    } catch {
      toast.error(t('appMembers.saveFailed'))
    } finally {
      setPendingId(null)
    }
  }

  const removeMember = async (member: ApplicationMemberDto) => {
    setPendingId(member.id)
    try {
      await apiRemoveApplicationMember(applicationId, member.id)
      await refresh()
      setRemoveId(null)
      toast.success(t('appMembers.removed'), { description: member.name })
    } catch {
      toast.error(t('appMembers.saveFailed'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">
            {t('appMembers.title')}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t('appMembers.description')}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setAddingOpen(true)}>
          <Plus />
          {t('appMembers.add')}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={memberSearch}
            onChange={(event) => {
              setMemberSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('appMembers.filterPlaceholder')}
            className="h-9 rounded-lg pl-9"
          />
        </div>
        <RoleFilterControl
          value={roleFilter}
          onChange={(value) => {
            setRoleFilter(value)
            setPage(1)
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.75rem] text-muted-foreground">
          {t('appMembers.filteredCount', {
            count: filteredMembers.length,
            total: members.length,
          })}
        </p>
        <p className="hidden text-[0.75rem] text-muted-foreground sm:block">
          {t('appMembers.roleHint')}
        </p>
      </div>

      {membersQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-[0.8125rem]">{t('common.loading')}</span>
        </div>
      ) : membersQuery.isError ? (
        <p className="py-8 text-center text-[0.8125rem] text-muted-foreground">
          {t('appMembers.loadFailed')}
        </p>
      ) : visibleMembers.length === 0 ? (
        <p className="rounded-xl bg-muted/20 py-10 text-center text-[0.8125rem] text-muted-foreground ring-1 ring-border/60">
          {t('appMembers.noMemberMatches')}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl ring-1 ring-border/70">
          {visibleMembers.map((member) => {
            const busy = pendingId === member.id
            return (
              <li
                key={member.id}
                className="bg-background/55 px-4 py-3 dark:bg-background/25"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <MemberIdentity member={member} />
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
                    <RoleControl
                      value={member.role}
                      canMaintain={member.platformRole !== 'viewer'}
                      disabled={busy || member.isOwner}
                      onChange={(role) => void updateRole(member, role)}
                    />
                    {member.isOwner ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex size-8 items-center justify-center text-muted-foreground">
                            <LockKeyhole className="size-3.5" />
                            <span className="sr-only">{t('appMembers.ownerLocked')}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('appMembers.ownerLocked')}</TooltipContent>
                      </Tooltip>
                    ) : removeId === member.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => void removeMember(member)}
                        >
                          {busy ? <Loader2 className="animate-spin" /> : <Check />}
                          {t('appMembers.confirmRemove')}
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setRemoveId(null)}
                        >
                          <X />
                          <span className="sr-only">{t('common.cancel')}</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setRemoveId(member.id)}
                      >
                        <Trash2 />
                        <span className="sr-only">
                          {t('appMembers.remove', { name: member.name })}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination page={effectivePage} totalPages={totalPages} onChange={setPage} />

      <Modal open={addingOpen} onOpenChange={setAddingOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t('appMembers.addTitle')}</ModalTitle>
            <ModalDescription>{t('appMembers.addDescription')}</ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
                placeholder={t('appMembers.searchPlaceholder')}
                className="h-10 rounded-lg pl-9"
                autoFocus
              />
            </div>
            <CandidateList
              candidates={candidatesQuery.data ?? []}
              loading={candidatesQuery.isLoading || candidatesQuery.isFetching}
              pendingId={pendingId}
              onAdd={addMember}
            />
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setAddingOpen(false)}>
              {t('common.done')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  )
}

function CandidateList({
  candidates,
  loading,
  pendingId,
  onAdd,
}: {
  candidates: ApplicationMemberCandidateDto[]
  loading: boolean
  pendingId: string | null
  onAdd: (candidate: ApplicationMemberCandidateDto, role: ApplicationMemberRole) => void
}) {
  const { t } = useTranslation()
  if (loading)
    return (
      <p className="py-12 text-center text-[0.8125rem] text-muted-foreground">
        {t('common.loading')}
      </p>
    )
  if (candidates.length === 0)
    return (
      <p className="py-12 text-center text-[0.8125rem] text-muted-foreground">
        {t('appMembers.noCandidates')}
      </p>
    )
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-lg ring-1 ring-border/60">
      {candidates.map((candidate) => {
        const busy = pendingId === candidate.id
        return (
          <li
            key={candidate.id}
            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center"
          >
            <MemberIdentity member={candidate} />
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              {candidate.platformRole === 'maintainer' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onAdd(candidate, 'maintainer')}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                  {t('appMembers.addAsMaintainer')}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onAdd(candidate, 'viewer')}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                {t('appMembers.addAsViewer')}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function MemberIdentity({
  member,
}: {
  member: Pick<ApplicationMemberDto, 'name' | 'email'>
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar size="sm">
        <AvatarFallback>
          <UserRound className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-medium text-foreground">
          {member.name}
        </p>
        <p className="truncate text-[0.75rem] text-muted-foreground">{member.email}</p>
      </div>
    </div>
  )
}

function RoleFilterControl({
  value,
  onChange,
}: {
  value: RoleFilter
  onChange: (value: RoleFilter) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className="flex shrink-0 rounded-lg bg-muted/40 p-0.5"
      role="group"
      aria-label={t('appMembers.filterRole')}
    >
      {(['all', 'maintainer', 'viewer'] as const).map((role) => (
        <button
          key={role}
          type="button"
          aria-pressed={value === role}
          onClick={() => onChange(role)}
          className={cn(
            'rounded-md px-2.5 py-1.5 text-[0.6875rem] font-medium transition-colors',
            value === role
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {role === 'all' ? t('common.all') : t(`appMembers.roleName.${role}`)}
        </button>
      ))}
    </div>
  )
}

function RoleControl({
  value,
  canMaintain,
  disabled,
  onChange,
}: {
  value: ApplicationMemberRole
  canMaintain: boolean
  disabled: boolean
  onChange: (role: ApplicationMemberRole) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className="flex rounded-lg bg-muted/40 p-0.5"
      role="group"
      aria-label={t('appMembers.role')}
    >
      {(['maintainer', 'viewer'] as const).map((role) => (
        <button
          key={role}
          type="button"
          disabled={disabled || (role === 'maintainer' && !canMaintain)}
          aria-pressed={value === role}
          title={
            role === 'maintainer' && !canMaintain
              ? t('appMembers.platformRoleInsufficient')
              : undefined
          }
          onClick={() => onChange(role)}
          className={cn(
            'rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45',
            value === role
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`appMembers.roleName.${role}`)}
        </button>
      ))}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-[0.75rem] tabular-nums text-muted-foreground">
        {t('common.pageOf', { page, total: totalPages })}
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft />
        <span className="sr-only">{t('common.previousPage')}</span>
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight />
        <span className="sr-only">{t('common.nextPage')}</span>
      </Button>
    </div>
  )
}
