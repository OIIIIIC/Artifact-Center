import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  HardDrive,
  KeyRound,
  Languages,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Plus,
  Search,
  Shield,
  Sun,
  Trash2,
  Users,
  UserRound,
} from 'lucide-react'

import { AppLayout, PageContainer, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
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
import { AvatarUpload } from '@/features/settings/avatar-upload'
import { RetentionSettingsPanel } from '@/features/settings/retention-settings-panel'
import { SettingsPanel } from '@/features/settings/settings-panel'
import { FormError } from '@/components/feedback'
import { MEMBER_ROLES, type MemberRole } from '@/features/settings/mock-members'
import { PasswordField, PasswordPolicyHints } from '@/features/settings/password-field'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { checkPassword } from '@/lib/password'
import { getRequestErrorMessage } from '@/lib/request-error'
import { ApiError } from '@/services/http'
import { isConnectivityError } from '@/services/http'
import {
  apiAdminResetPassword,
  apiCreateUser,
  apiDeleteUser,
  apiListApplications,
  apiListUsers,
  apiUpdateUser,
  apiUpsertApplicationMember,
} from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import { useLocaleStore } from '@/store/locale-store'
import { useThemeStore } from '@/store/theme-store'
import { LOCALE_LABEL, type AppLocale } from '@/types/locale'
import type { ThemeMode } from '@/types/theme'

type SettingsSection = 'general' | 'appearance' | 'members' | 'retention'

const SECTIONS: SettingsSection[] = ['general', 'appearance', 'retention']

const THEME_OPTIONS: {
  value: ThemeMode
  icon: typeof Sun
  labelKey: 'themeLight' | 'themeDark' | 'themeSystem'
}[] = [
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
]

const LOCALE_OPTIONS: AppLocale[] = ['zh-CN', 'en-US']
const MEMBER_PAGE_SIZE = 10

/**
 * Settings — left section nav + right panels.
 * Profile edit / members CRUD / appearance / retention.
 */
export function SettingsPage({ standalone }: { standalone?: 'members' }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const updateAvatar = useAuthStore((s) => s.updateAvatar)
  const changePassword = useAuthStore((s) => s.changePassword)
  const isAdmin = user?.role === 'admin'

  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  const membersQuery = useQuery({
    queryKey: queryKeys.users.list,
    queryFn: apiListUsers,
    enabled: isAdmin && standalone === 'members',
  })
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])

  const [section, setSection] = useState<SettingsSection>(
    standalone === 'members' ? 'members' : 'general',
  )

  // Profile — seed from user on first paint
  const [profileName, setProfileName] = useState(() => user?.name ?? '')
  const [profileEmail, setProfileEmail] = useState(() => user?.email ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Add member (admin creates user with initial password)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newMemberPassword, setNewMemberPassword] = useState('')
  const [newMemberPasswordConfirm, setNewMemberPasswordConfirm] = useState('')
  const [newRole, setNewRole] = useState<MemberRole>('viewer')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [applicationSearch, setApplicationSearch] = useState('')
  const [newApplicationRoles, setNewApplicationRoles] = useState<
    Record<string, 'maintainer' | 'viewer'>
  >({})
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberRoleFilter, setMemberRoleFilter] = useState<MemberRole | 'all'>('all')
  const [memberPage, setMemberPage] = useState(1)

  const applicationsQuery = useQuery({
    queryKey: queryKeys.applications.list({ sort: 'name' }),
    queryFn: () => apiListApplications({ sort: 'name' }),
    enabled: isAdmin && showAddMember,
  })

  // Admin reset password
  const [resetMemberId, setResetMemberId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const assignableApplications = useMemo(() => {
    const query = applicationSearch.trim().toLowerCase()
    return (applicationsQuery.data ?? []).filter(
      (application) =>
        !query ||
        application.name.toLowerCase().includes(query) ||
        application.packageName.toLowerCase().includes(query),
    )
  }, [applicationSearch, applicationsQuery.data])

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    return members.filter(
      (member) =>
        (!query ||
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)) &&
        (memberRoleFilter === 'all' || member.role === memberRoleFilter),
    )
  }, [memberRoleFilter, memberSearch, members])
  const memberTotalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / MEMBER_PAGE_SIZE),
  )
  const visibleMembers = filteredMembers.slice(
    (Math.min(memberPage, memberTotalPages) - 1) * MEMBER_PAGE_SIZE,
    Math.min(memberPage, memberTotalPages) * MEMBER_PAGE_SIZE,
  )

  const profileDirty =
    profileName.trim() !== (user?.name ?? '') ||
    profileEmail.trim() !== (user?.email ?? '')

  const sectionMeta: Record<SettingsSection, { label: string; icon: typeof UserRound }> =
    {
      general: { label: t('settings.navGeneral'), icon: UserRound },
      appearance: { label: t('settings.navAppearance'), icon: Palette },
      members: { label: t('settings.navMembers'), icon: Users },
      retention: { label: t('settings.navRetention'), icon: HardDrive },
    }

  const roleLabel = (role: MemberRole) => t(`settings.role.${role}`)

  const memberErrorFromApi = (err: unknown) => {
    if (isConnectivityError(err)) {
      return getRequestErrorMessage(err, {
        offline: t('common.requestFailedOffline'),
        unavailable: t('common.requestFailedUnavailable'),
        fallback: t('settings.memberErrorGeneric'),
      })
    }
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'email_taken':
          return t('settings.memberErrorDuplicate')
        case 'last_admin':
          return t('settings.memberErrorLastAdmin')
        case 'cannot_delete_self':
          return t('settings.memberErrorSelfDelete')
        case 'weak_password':
          return t('settings.passwordErrorWeak')
        case 'not_found':
          return t('settings.memberErrorNotFound')
        case 'forbidden':
          return t('settings.resetForbidden')
        case 'invalid_body':
          return t('settings.memberErrorEmpty')
        default:
          return err.message || t('settings.memberErrorGeneric')
      }
    }
    return t('settings.memberErrorGeneric')
  }

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all })

  const saveProfile = async () => {
    setProfileError(null)
    setProfileSaving(true)
    const result = await updateProfile({
      name: profileName,
      email: profileEmail,
    })
    setProfileSaving(false)
    if (!result.ok) {
      if (result.code === 'invalid_email') {
        setProfileError(t('settings.profileErrorEmail'))
      } else {
        setProfileError(t('settings.profileErrorEmpty'))
      }
      return
    }
    toast.success(t('settings.profileSaved'))
  }

  const onAvatarChange = async (dataUrl: string | null) => {
    const result = await updateAvatar(dataUrl)
    if (!result.ok) {
      toast.error(t('settings.memberErrorGeneric'))
      return
    }
    toast.success(dataUrl ? t('settings.avatarSaved') : t('settings.avatarRemoved'))
  }

  const onChangePassword = async () => {
    setPasswordError(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('settings.passwordErrorEmpty'))
      return
    }
    setPasswordSaving(true)
    const result = await changePassword({
      current: currentPassword,
      next: newPassword,
      confirm: confirmPassword,
    })
    setPasswordSaving(false)
    if (!result.ok) {
      if (result.code === 'wrong_password') {
        setPasswordError(t('settings.passwordErrorWrong'))
      } else if (result.code === 'mismatch') {
        setPasswordError(t('settings.passwordErrorMismatch'))
      } else if (result.code === 'same_as_current') {
        setPasswordError(t('settings.passwordErrorSame'))
      } else if (result.code === 'weak_password') {
        setPasswordError(t('settings.passwordErrorWeak'))
      } else {
        setPasswordError(t('settings.passwordErrorEmpty'))
      }
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    toast.success(t('settings.passwordChanged'))
  }

  const onAdminReset = async (memberId: string, memberName: string) => {
    setResetError(null)
    if (!resetPassword || !resetConfirm) {
      setResetError(t('settings.passwordErrorEmpty'))
      return
    }
    if (resetPassword !== resetConfirm) {
      setResetError(t('settings.passwordErrorMismatch'))
      return
    }
    const check = checkPassword(resetPassword, { confirm: resetConfirm })
    if (!check.ok) {
      setResetError(t('settings.passwordErrorWeak'))
      return
    }
    setResetting(true)
    try {
      await apiAdminResetPassword(memberId, resetPassword)
      setResetMemberId(null)
      setResetPassword('')
      setResetConfirm('')
      toast.success(t('settings.passwordReset'), {
        description: t('settings.passwordResetDesc', { name: memberName }),
      })
    } catch (err) {
      setResetError(memberErrorFromApi(err))
    } finally {
      setResetting(false)
    }
  }

  const onAddMember = async () => {
    setAddError(null)
    const name = newName.trim()
    const username = newUsername.trim()
    const email = newEmail.trim()
    if (!name || !username || !email || !newMemberPassword) {
      setAddError(t('settings.memberErrorEmptyFields'))
      return
    }
    if (newMemberPassword !== newMemberPasswordConfirm) {
      setAddError(t('settings.passwordErrorMismatch'))
      return
    }
    const check = checkPassword(newMemberPassword, {
      confirm: newMemberPasswordConfirm,
    })
    if (!check.ok) {
      setAddError(t('settings.passwordErrorWeak'))
      return
    }

    setAdding(true)
    try {
      const member = await apiCreateUser({
        name,
        username,
        email,
        password: newMemberPassword,
        role: newRole,
      })
      const assignments = Object.entries(newApplicationRoles)
      if (member.role !== 'admin' && assignments.length > 0) {
        const results = await Promise.allSettled(
          assignments.map(([applicationId, applicationRole]) =>
            apiUpsertApplicationMember(
              applicationId,
              member.id,
              member.role === 'viewer' ? 'viewer' : applicationRole,
            ),
          ),
        )
        const failed = results.filter((result) => result.status === 'rejected').length
        if (failed > 0) {
          toast.warning(t('settings.applicationAssignmentPartial'), {
            description: t('settings.applicationAssignmentPartialDesc', {
              success: assignments.length - failed,
              failed,
            }),
          })
        }
      }
      await invalidateMembers()
      toast.success(t('settings.memberAdded'), {
        description: t('settings.memberAddedDesc', {
          name: member.name,
          role: roleLabel(member.role),
        }),
      })
      setNewName('')
      setNewUsername('')
      setNewEmail('')
      setNewMemberPassword('')
      setNewMemberPasswordConfirm('')
      setNewRole('viewer')
      setApplicationSearch('')
      setNewApplicationRoles({})
      setShowAddMember(false)
    } catch (err) {
      setAddError(memberErrorFromApi(err))
    } finally {
      setAdding(false)
    }
  }

  const onChangeRole = async (id: string, role: MemberRole, name: string) => {
    try {
      await apiUpdateUser(id, { role })
      await invalidateMembers()
      toast.success(t('settings.roleUpdated'), {
        description: t('settings.roleUpdatedDesc', {
          name,
          role: roleLabel(role),
        }),
      })
    } catch (err) {
      toast.error(memberErrorFromApi(err))
    }
  }

  const onRemoveMember = async (id: string, name: string) => {
    setRemoveConfirmId(null)
    try {
      await apiDeleteUser(id)
      await invalidateMembers()
      toast.success(t('settings.memberRemoved'), {
        description: name,
      })
    } catch (err) {
      toast.error(memberErrorFromApi(err))
    }
  }

  const chipClass = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
      'transition-colors duration-[var(--duration-hover)]',
      active
        ? 'bg-foreground text-background'
        : 'bg-muted/40 text-muted-foreground hover:text-foreground',
    )

  const standaloneMembers = standalone === 'members'

  return (
    <AppLayout
      breadcrumbs={[{ label: standaloneMembers ? t('nav.members') : t('nav.settings') }]}
    >
      <PageContainer rhythm="product">
        <PageHeader
          title={standaloneMembers ? t('settings.membersTitle') : t('settings.title')}
          description={
            standaloneMembers ? t('settings.membersDesc') : t('settings.description')
          }
        />

        <div
          className={cn(
            'mt-8 flex flex-col gap-8 sm:mt-9',
            !standaloneMembers && 'lg:flex-row lg:gap-10 xl:gap-12',
          )}
        >
          {!standaloneMembers ? (
            <nav
              aria-label={t('settings.sectionNav')}
              className={cn(
                'flex shrink-0 gap-1 overflow-x-auto pb-1',
                'lg:sticky lg:top-6 lg:w-[var(--settings-nav-width)] lg:flex-col lg:overflow-visible lg:pb-0',
              )}
            >
              {SECTIONS.map((id) => {
                const meta = sectionMeta[id]
                const Icon = meta.icon
                const active = section === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSection(id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.8125rem] font-medium',
                      'transition-colors duration-[var(--duration-hover)]',
                      active
                        ? 'bg-muted/70 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="size-3.5 opacity-70" strokeWidth={1.75} />
                    {meta.label}
                  </button>
                )
              })}
            </nav>
          ) : null}

          <div className="min-w-0 flex-1">
            {section === 'general' ? (
              <div className="space-y-8">
                <SettingsPanel
                  title={t('settings.generalTitle')}
                  description={t('settings.generalDesc')}
                >
                  <div
                    className={cn(
                      'space-y-5 rounded-2xl bg-card/60 p-5',
                      'ring-1 ring-border/70 dark:bg-card/40',
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <AvatarUpload
                        name={user?.name ?? profileName}
                        avatarUrl={user?.avatarUrl}
                        onChange={onAvatarChange}
                        disabled={profileSaving}
                      />
                      <div className="space-y-2 sm:text-right">
                        <Badge
                          variant="secondary"
                          className="gap-1 rounded-md font-normal"
                        >
                          <Shield className="size-3 opacity-70" strokeWidth={1.75} />
                          {user ? roleLabel(user.role) : '—'}
                        </Badge>
                        <p className="text-[0.75rem] text-muted-foreground">
                          {t('settings.accountHint')}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block space-y-1.5 sm:col-span-1">
                        <span className="text-[0.8125rem] font-medium text-foreground">
                          {t('settings.fieldName')}
                        </span>
                        <Input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="h-10 rounded-lg"
                          disabled={profileSaving}
                          autoComplete="name"
                        />
                      </label>
                      <label className="block space-y-1.5 sm:col-span-1">
                        <span className="text-[0.8125rem] font-medium text-foreground">
                          {t('settings.fieldEmail')}
                        </span>
                        <Input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          className="h-10 rounded-lg"
                          disabled={profileSaving}
                          autoComplete="email"
                        />
                      </label>
                    </div>

                    <FormError message={profileError} />

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="lg"
                        className="min-w-[6.5rem]"
                        disabled={profileSaving || !profileDirty}
                        onClick={() => void saveProfile()}
                      >
                        {profileSaving ? t('settings.saving') : t('settings.saveProfile')}
                      </Button>
                    </div>
                  </div>
                </SettingsPanel>

                <SettingsPanel
                  title={t('settings.passwordTitle')}
                  description={t('settings.passwordDesc')}
                >
                  <div
                    className={cn(
                      'overflow-hidden rounded-2xl',
                      'ring-1 ring-border/70 dark:ring-border/80',
                      'bg-card/60 dark:bg-card/40',
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-start gap-3 border-b border-border/60 px-5 py-3.5',
                        'bg-muted/20 dark:bg-muted/10',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                          'bg-muted text-muted-foreground',
                        )}
                        aria-hidden
                      >
                        <KeyRound className="size-3.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 space-y-2">
                        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                          {t('settings.passwordLead')}
                        </p>
                        <PasswordPolicyHints />
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <PasswordField
                        id="current-password"
                        label={t('settings.fieldCurrentPassword')}
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        autoComplete="current-password"
                        disabled={passwordSaving}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <PasswordField
                          id="new-password"
                          label={t('settings.fieldNewPassword')}
                          value={newPassword}
                          onChange={setNewPassword}
                          autoComplete="new-password"
                          disabled={passwordSaving}
                          showStrength
                          current={currentPassword}
                          confirm={confirmPassword}
                        />
                        <PasswordField
                          id="confirm-password"
                          label={t('settings.fieldConfirmPassword')}
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          autoComplete="new-password"
                          disabled={passwordSaving}
                          matchAgainst={newPassword}
                        />
                      </div>
                      <FormError message={passwordError} />
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-4">
                        <Button
                          type="button"
                          size="lg"
                          className="min-w-[7rem]"
                          disabled={
                            passwordSaving ||
                            !currentPassword ||
                            !newPassword ||
                            !confirmPassword
                          }
                          onClick={() => void onChangePassword()}
                        >
                          {passwordSaving
                            ? t('settings.changingPassword')
                            : t('settings.changePassword')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </SettingsPanel>
              </div>
            ) : null}

            {section === 'appearance' ? (
              <SettingsPanel
                title={t('settings.appearanceTitle')}
                description={t('settings.appearanceDesc')}
              >
                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-foreground">
                      <Sun className="size-3.5 opacity-70" strokeWidth={1.75} />
                      {t('common.theme')}
                    </div>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label={t('common.theme')}
                    >
                      {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTheme(value)}
                          className={cn(
                            chipClass(theme === value),
                            'inline-flex items-center gap-1.5',
                          )}
                          aria-pressed={theme === value}
                        >
                          <Icon className="size-3.5" strokeWidth={1.75} />
                          {t(`common.${labelKey}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-foreground">
                      <Languages className="size-3.5 opacity-70" strokeWidth={1.75} />
                      {t('common.language')}
                    </div>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label={t('common.language')}
                    >
                      {LOCALE_OPTIONS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setLocale(value)}
                          className={chipClass(locale === value)}
                          aria-pressed={locale === value}
                        >
                          {LOCALE_LABEL[value]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SettingsPanel>
            ) : null}

            {section === 'members' ? (
              <SettingsPanel
                title={t('settings.membersTitle')}
                description={t('settings.membersDesc')}
                wide
                hideHeader={standaloneMembers}
              >
                <div
                  className={cn(
                    'mb-4 space-y-2.5 rounded-2xl bg-muted/25 p-4 ring-1 ring-border/60',
                    'dark:bg-muted/15',
                  )}
                >
                  <p className="text-[0.75rem] font-medium text-foreground">
                    {t('settings.roleLegendTitle')}
                  </p>
                  <ul className="space-y-2">
                    {MEMBER_ROLES.map((role) => (
                      <li
                        key={role}
                        className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3"
                      >
                        <span className="shrink-0 text-[0.8125rem] font-medium text-foreground sm:w-20">
                          {roleLabel(role)}
                        </span>
                        <span className="text-[0.75rem] leading-relaxed text-muted-foreground">
                          {t(`settings.roleDesc.${role}`)}
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
                          value={memberSearch}
                          onChange={(event) => {
                            setMemberSearch(event.target.value)
                            setMemberPage(1)
                          }}
                          placeholder={t('settings.memberSearchPlaceholder')}
                          className="h-9 rounded-lg pl-9"
                        />
                      </div>
                      <div className="flex rounded-lg bg-muted/40 p-0.5" role="group">
                        {(['all', ...MEMBER_ROLES] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            aria-pressed={memberRoleFilter === role}
                            onClick={() => {
                              setMemberRoleFilter(role)
                              setMemberPage(1)
                            }}
                            className={cn(
                              'rounded-md px-2.5 py-1.5 text-[0.6875rem] font-medium transition-colors',
                              memberRoleFilter === role
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {role === 'all' ? t('common.all') : roleLabel(role)}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setShowAddMember(true)
                          setAddError(null)
                        }}
                      >
                        <Plus className="size-3.5" strokeWidth={1.75} />
                        {t('settings.addMember')}
                      </Button>
                    </div>

                    <p className="mb-3 text-[0.75rem] text-muted-foreground">
                      {t('settings.memberFilteredCount', {
                        count: filteredMembers.length,
                        total: members.length,
                      })}
                    </p>

                    <Modal open={showAddMember} onOpenChange={setShowAddMember}>
                      <ModalContent>
                        <ModalHeader>
                          <ModalTitle>{t('settings.addMemberTitle')}</ModalTitle>
                          <ModalDescription>
                            {t('settings.addMemberHint')}
                          </ModalDescription>
                        </ModalHeader>
                        <ModalBody className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1.5">
                              <span className="text-[0.75rem] font-medium text-foreground">
                                {t('settings.fieldName')}
                              </span>
                              <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={t('settings.memberNamePlaceholder')}
                                className="h-10 rounded-lg"
                                disabled={adding}
                              />
                            </label>
                            <label className="block space-y-1.5">
                              <span className="text-[0.75rem] font-medium text-foreground">
                                {t('settings.fieldUsername')}
                              </span>
                              <Input
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder={t('settings.memberUsernamePlaceholder')}
                                className="h-10 rounded-lg"
                                disabled={adding}
                                autoComplete="username"
                              />
                            </label>
                            <label className="block space-y-1.5">
                              <span className="text-[0.75rem] font-medium text-foreground">
                                {t('settings.fieldEmail')}
                              </span>
                              <Input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder={t('settings.memberEmailPlaceholder')}
                                className="h-10 rounded-lg"
                                disabled={adding}
                              />
                            </label>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <PasswordField
                              id="new-member-password"
                              label={t('settings.fieldInitialPassword')}
                              value={newMemberPassword}
                              onChange={setNewMemberPassword}
                              autoComplete="new-password"
                              disabled={adding}
                              showStrength
                              confirm={newMemberPasswordConfirm}
                            />
                            <PasswordField
                              id="new-member-password-confirm"
                              label={t('settings.fieldInitialPasswordConfirm')}
                              value={newMemberPasswordConfirm}
                              onChange={setNewMemberPasswordConfirm}
                              autoComplete="new-password"
                              disabled={adding}
                              matchAgainst={newMemberPassword}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[0.75rem] font-medium text-foreground">
                              {t('settings.fieldRole')}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {MEMBER_ROLES.map((role) => (
                                <button
                                  key={role}
                                  type="button"
                                  disabled={adding}
                                  onClick={() => setNewRole(role)}
                                  className={cn(
                                    'rounded-md px-2.5 py-1 text-[0.75rem] font-medium',
                                    'transition-colors duration-[var(--duration-hover)]',
                                    newRole === role
                                      ? 'bg-foreground text-background'
                                      : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                                  )}
                                  aria-pressed={newRole === role}
                                >
                                  {roleLabel(role)}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-[0.75rem] font-medium text-foreground">
                                {t('settings.initialApplications')}
                                <span className="ml-1.5 font-normal text-muted-foreground">
                                  {t('createApp.optional')}
                                </span>
                              </p>
                              <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                                {newRole === 'admin'
                                  ? t('settings.adminApplicationAccessHint')
                                  : t('settings.initialApplicationsHint')}
                              </p>
                            </div>
                            {newRole !== 'admin' ? (
                              applicationsQuery.isLoading ? (
                                <p className="py-4 text-center text-[0.75rem] text-muted-foreground">
                                  {t('common.loading')}
                                </p>
                              ) : (applicationsQuery.data?.length ?? 0) === 0 ? (
                                <p className="rounded-lg bg-muted/25 px-3 py-4 text-center text-[0.75rem] text-muted-foreground ring-1 ring-border/60">
                                  {t('settings.noApplicationsToAssign')}
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <div className="relative">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                      value={applicationSearch}
                                      onChange={(event) =>
                                        setApplicationSearch(event.target.value)
                                      }
                                      placeholder={t(
                                        'settings.applicationSearchPlaceholder',
                                      )}
                                      className="h-9 rounded-lg pl-9"
                                    />
                                  </div>
                                  <p className="text-[0.6875rem] text-muted-foreground">
                                    {t('settings.selectedApplications', {
                                      count: Object.keys(newApplicationRoles).length,
                                    })}
                                  </p>
                                  {assignableApplications.length === 0 ? (
                                    <p className="rounded-lg bg-muted/25 px-3 py-6 text-center text-[0.75rem] text-muted-foreground ring-1 ring-border/60">
                                      {t('settings.noApplicationMatches')}
                                    </p>
                                  ) : (
                                    <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-xl ring-1 ring-border/70">
                                      {assignableApplications.map((application) => {
                                        const selectedRole =
                                          newApplicationRoles[application.id]
                                        const selected = selectedRole != null
                                        return (
                                          <li
                                            key={application.id}
                                            className="flex flex-col gap-2 bg-background/40 px-3 py-2.5 sm:flex-row sm:items-center"
                                          >
                                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                                              <input
                                                type="checkbox"
                                                checked={selected}
                                                disabled={adding}
                                                onChange={(event) => {
                                                  setNewApplicationRoles((current) => {
                                                    const next = { ...current }
                                                    if (event.target.checked) {
                                                      next[application.id] =
                                                        newRole === 'maintainer'
                                                          ? 'maintainer'
                                                          : 'viewer'
                                                    } else {
                                                      delete next[application.id]
                                                    }
                                                    return next
                                                  })
                                                }}
                                                className="size-4 shrink-0 accent-foreground"
                                              />
                                              <span className="min-w-0">
                                                <span className="block truncate text-[0.8125rem] font-medium text-foreground">
                                                  {application.name}
                                                </span>
                                                <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground">
                                                  {application.packageName}
                                                </span>
                                              </span>
                                            </label>
                                            {selected ? (
                                              <div
                                                className="flex rounded-lg bg-muted/40 p-0.5"
                                                role="group"
                                              >
                                                {(['maintainer', 'viewer'] as const).map(
                                                  (applicationRole) => (
                                                    <button
                                                      key={applicationRole}
                                                      type="button"
                                                      disabled={
                                                        adding ||
                                                        (newRole === 'viewer' &&
                                                          applicationRole ===
                                                            'maintainer')
                                                      }
                                                      onClick={() =>
                                                        setNewApplicationRoles(
                                                          (current) => ({
                                                            ...current,
                                                            [application.id]:
                                                              applicationRole,
                                                          }),
                                                        )
                                                      }
                                                      aria-pressed={
                                                        (newRole === 'viewer'
                                                          ? 'viewer'
                                                          : selectedRole) ===
                                                        applicationRole
                                                      }
                                                      className={cn(
                                                        'rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors',
                                                        'disabled:cursor-not-allowed disabled:opacity-40',
                                                        (newRole === 'viewer'
                                                          ? 'viewer'
                                                          : selectedRole) ===
                                                          applicationRole
                                                          ? 'bg-background text-foreground shadow-sm'
                                                          : 'text-muted-foreground hover:text-foreground',
                                                      )}
                                                    >
                                                      {t(
                                                        `appMembers.roleName.${applicationRole}`,
                                                      )}
                                                    </button>
                                                  ),
                                                )}
                                              </div>
                                            ) : null}
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  )}
                                </div>
                              )
                            ) : null}
                          </div>
                          <FormError message={addError} />
                        </ModalBody>
                        <ModalFooter>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-0 bg-muted/40 ring-1 ring-border/60"
                            disabled={adding}
                            onClick={() => {
                              setShowAddMember(false)
                              setAddError(null)
                            }}
                          >
                            {t('common.cancel')}
                          </Button>
                          <Button
                            type="button"
                            size="lg"
                            disabled={adding}
                            onClick={() => void onAddMember()}
                          >
                            {adding
                              ? t('settings.addingMember')
                              : t('settings.confirmAddMember')}
                          </Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>

                    {membersQuery.isLoading ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                        <span className="text-[0.8125rem]">{t('common.loading')}</span>
                      </div>
                    ) : membersQuery.isError ? (
                      <p className="py-6 text-center text-[0.875rem] text-muted-foreground">
                        {t('settings.memberErrorGeneric')}
                      </p>
                    ) : visibleMembers.length === 0 ? (
                      <p className="rounded-xl bg-muted/20 py-10 text-center text-[0.8125rem] text-muted-foreground ring-1 ring-border/60">
                        {t('settings.noMemberMatches')}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl ring-1 ring-border/70">
                        {visibleMembers.map((m) => {
                          const isSelf =
                            user?.email.toLowerCase() === m.email.toLowerCase()
                          const showReset = !isSelf
                          return (
                            <li
                              key={m.id}
                              className="flex flex-col gap-3 bg-card/40 px-4 py-3.5 dark:bg-card/25"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate text-[0.875rem] font-medium text-foreground">
                                    {m.name}
                                    {isSelf ? (
                                      <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
                                        {t('settings.you')}
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="truncate text-[0.75rem] text-muted-foreground">
                                    {m.email}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div
                                    className="flex flex-wrap gap-1"
                                    role="group"
                                    aria-label={t('settings.changeRole', {
                                      name: m.name,
                                    })}
                                  >
                                    {MEMBER_ROLES.map((role) => {
                                      const active = m.role === role
                                      return (
                                        <button
                                          key={role}
                                          type="button"
                                          title={t(`settings.roleDesc.${role}`)}
                                          onClick={() => {
                                            if (m.role === role) return
                                            void onChangeRole(m.id, role, m.name)
                                          }}
                                          className={cn(
                                            'rounded-md px-2.5 py-1 text-[0.75rem] font-medium',
                                            'transition-colors duration-[var(--duration-hover)]',
                                            active
                                              ? 'bg-foreground text-background'
                                              : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                                          )}
                                          aria-pressed={active}
                                        >
                                          {roleLabel(role)}
                                        </button>
                                      )
                                    })}
                                  </div>
                                  {showReset ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 text-muted-foreground hover:text-foreground"
                                      aria-label={t('settings.resetPassword')}
                                      title={t('settings.resetPassword')}
                                      onClick={() => {
                                        setResetMemberId((id) =>
                                          id === m.id ? null : m.id,
                                        )
                                        setResetPassword('')
                                        setResetConfirm('')
                                        setResetError(null)
                                      }}
                                    >
                                      <KeyRound className="size-3.5" strokeWidth={1.75} />
                                    </Button>
                                  ) : null}
                                  {removeConfirmId === m.id ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[0.75rem] text-muted-foreground">
                                        {t('settings.removeConfirm')}
                                      </span>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="bg-destructive px-2.5 text-[0.75rem] text-white hover:bg-destructive/90"
                                        onClick={() => void onRemoveMember(m.id, m.name)}
                                      >
                                        {t('settings.confirmRemove')}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-0 bg-muted/40 px-2.5 text-[0.75rem] ring-1 ring-border/60"
                                        onClick={() => setRemoveConfirmId(null)}
                                      >
                                        {t('common.cancel')}
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 text-muted-foreground hover:text-destructive"
                                      disabled={isSelf}
                                      aria-label={t('settings.removeMember', {
                                        name: m.name,
                                      })}
                                      onClick={() => setRemoveConfirmId(m.id)}
                                    >
                                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {showReset && resetMemberId === m.id ? (
                                <div
                                  className={cn(
                                    'space-y-3 rounded-xl p-4',
                                    'bg-muted/25 ring-1 ring-border/60',
                                    'dark:bg-muted/15',
                                  )}
                                >
                                  <div>
                                    <p className="text-[0.8125rem] font-medium text-foreground">
                                      {t('settings.resetPasswordTitle', {
                                        name: m.name,
                                      })}
                                    </p>
                                    <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                                      {t('settings.resetPasswordDesc')}
                                    </p>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <PasswordField
                                      id={`reset-pw-${m.id}`}
                                      label={t('settings.fieldTempPassword')}
                                      value={resetPassword}
                                      onChange={setResetPassword}
                                      autoComplete="new-password"
                                      disabled={resetting}
                                      showStrength
                                      confirm={resetConfirm}
                                    />
                                    <PasswordField
                                      id={`reset-pw-confirm-${m.id}`}
                                      label={t('settings.fieldTempConfirm')}
                                      value={resetConfirm}
                                      onChange={setResetConfirm}
                                      autoComplete="new-password"
                                      disabled={resetting}
                                      matchAgainst={resetPassword}
                                    />
                                  </div>
                                  <FormError message={resetError} />
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="border-0 bg-muted/40 ring-1 ring-border/60"
                                      disabled={resetting}
                                      onClick={() => {
                                        setResetMemberId(null)
                                        setResetError(null)
                                      }}
                                    >
                                      {t('common.cancel')}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="lg"
                                      disabled={
                                        resetting || !resetPassword || !resetConfirm
                                      }
                                      onClick={() => void onAdminReset(m.id, m.name)}
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
                    {memberTotalPages > 1 ? (
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <span className="text-[0.75rem] tabular-nums text-muted-foreground">
                          {t('common.pageOf', {
                            page: Math.min(memberPage, memberTotalPages),
                            total: memberTotalPages,
                          })}
                        </span>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          disabled={memberPage <= 1}
                          onClick={() => setMemberPage((page) => page - 1)}
                        >
                          <ChevronLeft />
                          <span className="sr-only">{t('common.previousPage')}</span>
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          disabled={memberPage >= memberTotalPages}
                          onClick={() => setMemberPage((page) => page + 1)}
                        >
                          <ChevronRight />
                          <span className="sr-only">{t('common.nextPage')}</span>
                        </Button>
                      </div>
                    ) : null}
                    <p className="mt-3 text-[0.75rem] text-muted-foreground">
                      {t('settings.membersHint')}
                    </p>
                  </>
                )}
              </SettingsPanel>
            ) : null}

            {section === 'retention' ? (
              <RetentionSettingsPanel isAdmin={isAdmin} />
            ) : null}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}
