import { Check, Loader2, LockKeyhole, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApplicationAccessGrantDto, TeamMemberDto } from '@/services/api'
import type { Application } from '@/types/application'

type ApplicationRole = 'maintainer' | 'viewer'

type AccessPermissionsWorkspaceProps = {
  user: TeamMemberDto
  applications: Application[]
  grants: ApplicationAccessGrantDto[]
  saving: boolean
  onApply: (input: {
    operation: 'set' | 'remove'
    applicationIds: string[]
    role: ApplicationRole
  }) => Promise<boolean>
}

/** 用户已选定后的应用权限工作区；内部管理筛选与选择，调用方只处理读取和保存。 */
export function AccessPermissionsWorkspace({
  user,
  applications,
  grants,
  saving,
  onApply,
}: AccessPermissionsWorkspaceProps) {
  const { t } = useTranslation()
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [regionId, setRegionId] = useState('all')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<ApplicationRole>('viewer')
  const grantByApplication = useMemo(
    () => new Map(grants.map((grant) => [grant.applicationId, grant])),
    [grants],
  )
  const regions = useMemo(
    () =>
      [
        ...new Map(
          applications.map((application) => [application.region.id, application.region]),
        ).values(),
      ].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [applications],
  )
  const visibleApplications = useMemo(() => {
    const query = search.trim().toLowerCase()
    return applications.filter(
      (application) =>
        (regionId === 'all' || application.region.id === regionId) &&
        (!query ||
          application.name.toLowerCase().includes(query) ||
          application.packageName.toLowerCase().includes(query)),
    )
  }, [applications, regionId, search])
  const editableApplications = visibleApplications.filter(
    (application) => !grantByApplication.get(application.id)?.isOwner,
  )
  const allVisibleSelected =
    editableApplications.length > 0 &&
    editableApplications.every((application) =>
      selectedApplicationIds.has(application.id),
    )

  const toggleApplication = (applicationId: string) => {
    setSelectedApplicationIds((current) => {
      const next = new Set(current)
      if (next.has(applicationId)) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })
  }
  const toggleVisible = () => {
    setSelectedApplicationIds((current) => {
      const next = new Set(current)
      editableApplications.forEach((application) => {
        if (allVisibleSelected) next.delete(application.id)
        else next.add(application.id)
      })
      return next
    })
  }
  const apply = async (operation: 'set' | 'remove') => {
    const applicationIds = [...selectedApplicationIds]
    if (!applicationIds.length) return
    const completed = await onApply({ operation, applicationIds, role })
    if (completed) setSelectedApplicationIds(new Set())
  }

  return (
    <>
      <div className="border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[0.9375rem] font-semibold">{user.name}</h3>
              <PlatformRoleBadge user={user} />
            </div>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              {t('access.assignmentHint')}
            </p>
          </div>
          <div className="flex rounded-lg bg-muted/45 p-0.5" role="group">
            {(['viewer', 'maintainer'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`rounded-md px-2.5 py-1.5 text-[0.6875rem] font-medium transition-colors ${
                  role === value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                {t(`access.role.${value}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 rounded-lg pl-8 text-[0.8125rem]"
            placeholder={t('access.searchApplications')}
          />
        </label>
        <Select value={regionId} onValueChange={setRegionId}>
          <SelectTrigger className="h-9 w-[10rem] bg-background text-[0.75rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('access.allRegions')}</SelectItem>
            {regions.map((region) => (
              <SelectItem key={region.id} value={region.id}>
                {region.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <label className="flex cursor-pointer items-center gap-2 text-[0.75rem] text-muted-foreground">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleVisible}
            className="size-3.5 rounded border-border accent-primary"
          />
          {t('access.selectVisible')}
        </label>
        <span className="text-[0.75rem] text-muted-foreground">
          {t('access.selectedCount', { count: selectedApplicationIds.size })}
        </span>
      </div>

      <ul className="divide-y divide-border/60 border-y border-border/60">
        {visibleApplications.map((application) => {
          const grant = grantByApplication.get(application.id)
          const locked = grant?.isOwner === true
          const selected = selectedApplicationIds.has(application.id)
          return (
            <li
              key={application.id}
              className="flex items-center gap-3 px-4 py-3 sm:px-5"
            >
              <input
                type="checkbox"
                checked={selected || locked}
                disabled={locked}
                onChange={() => toggleApplication(application.id)}
                className="size-3.5 shrink-0 rounded border-border accent-primary disabled:cursor-not-allowed"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-medium">
                  {application.name}
                </p>
                <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">
                  {application.region.name} · {application.packageName}
                </p>
              </div>
              {locked ? (
                <span className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                  <LockKeyhole className="size-3" /> {t('access.owner')}
                </span>
              ) : grant ? (
                <span className="rounded-md bg-muted px-2 py-1 text-[0.6875rem] text-muted-foreground">
                  {t(`access.role.${grant.role}`)}
                </span>
              ) : (
                <span className="text-[0.6875rem] text-muted-foreground/70">
                  {t('access.unassigned')}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {visibleApplications.length === 0 ? (
        <p className="px-5 py-10 text-center text-[0.8125rem] text-muted-foreground">
          {t('access.noApplications')}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
          {t('access.scopeHint')}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving || selectedApplicationIds.size === 0}
            onClick={() => void apply('remove')}
            className="text-muted-foreground hover:text-destructive"
          >
            {t('access.remove')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || selectedApplicationIds.size === 0}
            onClick={() => void apply('set')}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            {t('access.applyRole', { role: t(`access.role.${role}`) })}
          </Button>
        </div>
      </div>
    </>
  )
}

export function AdminAccessNotice() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ShieldCheck className="size-5" />
      </span>
      <p className="mt-3 text-[0.875rem] font-medium">{t('access.adminAutoTitle')}</p>
      <p className="mt-1 max-w-sm text-[0.75rem] leading-relaxed text-muted-foreground">
        {t('access.adminAutoDescription')}
      </p>
    </div>
  )
}

function PlatformRoleBadge({ user }: { user: TeamMemberDto }) {
  const { t } = useTranslation()
  return (
    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
      {t(`access.platformRole.${user.role}`)}
    </span>
  )
}
