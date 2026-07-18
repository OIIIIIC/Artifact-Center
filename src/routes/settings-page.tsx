import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  HardDrive,
  KeyRound,
  Languages,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Plus,
  Shield,
  Sun,
  Trash2,
  Users,
  UserRound,
} from 'lucide-react'

import { AppLayout, FormStack, PageContainer, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AvatarUpload } from '@/features/settings/avatar-upload'
import { MEMBER_ROLES, type MemberRole } from '@/features/settings/mock-members'
import { PasswordField, PasswordPolicyHints } from '@/features/settings/password-field'
import { formatFileSize } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { checkPassword } from '@/lib/password'
import { ApiError } from '@/services/http'
import {
  apiAdminResetPassword,
  apiCreateUser,
  apiDeleteUser,
  apiGetRetention,
  apiListUsers,
  apiRunRetentionCleanup,
  apiUpdateRetention,
  apiUpdateUser,
} from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import { useLocaleStore } from '@/store/locale-store'
import { useThemeStore } from '@/store/theme-store'
import { LOCALE_LABEL, type AppLocale } from '@/types/locale'
import type { ThemeMode } from '@/types/theme'

type SettingsSection = 'general' | 'appearance' | 'members' | 'retention' | 'danger'

const SECTIONS: SettingsSection[] = [
  'general',
  'appearance',
  'members',
  'retention',
  'danger',
]

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

/**
 * Settings — left section nav + right panels.
 * Profile edit / members CRUD / appearance / retention / danger.
 */
export function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const updateAvatar = useAuthStore((s) => s.updateAvatar)
  const changePassword = useAuthStore((s) => s.changePassword)
  const logout = useAuthStore((s) => s.logout)
  const isAdmin = user?.role === 'admin'

  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  const membersQuery = useQuery({
    queryKey: queryKeys.users.list,
    queryFn: apiListUsers,
    enabled: isAdmin,
  })
  const members = membersQuery.data ?? []

  const retentionQuery = useQuery({
    queryKey: ['settings', 'retention'],
    queryFn: apiGetRetention,
  })
  const retention = retentionQuery.data

  const [section, setSection] = useState<SettingsSection>('general')
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [retentionSaving, setRetentionSaving] = useState(false)
  const [cleanupRunning, setCleanupRunning] = useState(false)

  // Profile — seed from user on first paint
  const [profileName, setProfileName] = useState(() => user?.name ?? '')
  const [profileEmail, setProfileEmail] = useState(() => user?.email ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSeedId, setProfileSeedId] = useState(user?.id)

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Add member (admin creates user with initial password)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newMemberPassword, setNewMemberPassword] = useState('')
  const [newMemberPasswordConfirm, setNewMemberPasswordConfirm] = useState('')
  const [newRole, setNewRole] = useState<MemberRole>('viewer')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)

  // Admin reset password
  const [resetMemberId, setResetMemberId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  // Retention fields (local draft)
  const [maxVersions, setMaxVersions] = useState('20')
  const [archiveDays, setArchiveDays] = useState('90')
  const [retentionHydrated, setRetentionHydrated] = useState(false)

  // Sync when user identity changes (login switch) — adjust during render
  if (user?.id && user.id !== profileSeedId) {
    setProfileSeedId(user.id)
    setProfileName(user.name)
    setProfileEmail(user.email)
  }

  if (retention && !retentionHydrated) {
    setMaxVersions(String(retention.maxVersions))
    setArchiveDays(String(retention.archiveDeprecatedDays))
    setRetentionHydrated(true)
  }
  if (!retention && retentionHydrated) {
    setRetentionHydrated(false)
  }

  const storagePct = useMemo(() => {
    if (!retention || retention.storageQuotaBytes <= 0) return 0
    return Math.min(
      100,
      Math.round((retention.storageUsedBytes / retention.storageQuotaBytes) * 100),
    )
  }, [retention])

  const profileDirty =
    profileName.trim() !== (user?.name ?? '') ||
    profileEmail.trim() !== (user?.email ?? '')

  const sectionMeta: Record<SettingsSection, { label: string; icon: typeof UserRound }> =
    {
      general: { label: t('settings.navGeneral'), icon: UserRound },
      appearance: { label: t('settings.navAppearance'), icon: Palette },
      members: { label: t('settings.navMembers'), icon: Users },
      retention: { label: t('settings.navRetention'), icon: HardDrive },
      danger: { label: t('settings.navDanger'), icon: AlertTriangle },
    }

  const roleLabel = (role: MemberRole) => t(`settings.role.${role}`)

  const memberErrorFromApi = (err: unknown) => {
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

  const saveRetention = async () => {
    if (!isAdmin) {
      toast.error(t('settings.retentionAdminOnly'))
      return
    }
    const max = Number.parseInt(maxVersions, 10)
    const days = Number.parseInt(archiveDays, 10)
    if (
      !Number.isFinite(max) ||
      max < 1 ||
      max > 999 ||
      !Number.isFinite(days) ||
      days < 1 ||
      days > 3650
    ) {
      toast.error(t('settings.retentionInvalid'))
      return
    }
    setRetentionSaving(true)
    try {
      await apiUpdateRetention({
        maxVersions: max,
        archiveDeprecatedDays: days,
      })
      await queryClient.invalidateQueries({
        queryKey: ['settings', 'retention'],
      })
      setRetentionHydrated(false)
      toast.success(t('settings.retentionSaved'))
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t('settings.retentionSaveFailed'),
      )
    } finally {
      setRetentionSaving(false)
    }
  }

  const runCleanup = async () => {
    if (!isAdmin) return
    setCleanupRunning(true)
    try {
      const { report } = await apiRunRetentionCleanup()
      await queryClient.invalidateQueries({
        queryKey: ['settings', 'retention'],
      })
      setRetentionHydrated(false)
      toast.success(t('settings.cleanupDone'), {
        description: t('settings.cleanupDoneDesc', {
          deleted: report.deletedVersions,
          archived: report.archivedDeprecated,
        }),
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('settings.cleanupFailed'))
    } finally {
      setCleanupRunning(false)
    }
  }

  const onAddMember = async () => {
    setAddError(null)
    const name = newName.trim()
    const email = newEmail.trim()
    if (!name || !email || !newMemberPassword) {
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
        email,
        password: newMemberPassword,
        role: newRole,
      })
      await invalidateMembers()
      toast.success(t('settings.memberAdded'), {
        description: t('settings.memberAddedDesc', {
          name: member.name,
          role: roleLabel(member.role),
        }),
      })
      setNewName('')
      setNewEmail('')
      setNewMemberPassword('')
      setNewMemberPasswordConfirm('')
      setNewRole('viewer')
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

  const onLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const chipClass = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium',
      'transition-colors duration-[var(--duration-hover)]',
      active
        ? 'bg-foreground text-background'
        : 'bg-muted/40 text-muted-foreground hover:text-foreground',
    )

  const fieldClass = cn(
    'h-10 w-full rounded-lg bg-muted/30 px-3 text-[0.875rem] outline-none',
    'ring-1 ring-border/60 transition-[box-shadow,background-color] duration-[var(--duration-hover)]',
    'placeholder:text-muted-foreground/60',
    'focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30',
  )

  return (
    <AppLayout breadcrumbs={[{ label: t('nav.settings') }]}>
      <PageContainer rhythm="product">
        <PageHeader title={t('settings.title')} description={t('settings.description')} />

        <div className="mt-8 flex flex-col gap-8 sm:mt-9 lg:flex-row lg:gap-10 xl:gap-12">
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

          <div className="min-w-0 flex-1">
            {section === 'general' ? (
              <div className="space-y-8">
                <Panel
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

                    {profileError ? (
                      <p className="text-[0.8125rem] text-muted-foreground" role="alert">
                        {profileError}
                      </p>
                    ) : null}

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
                </Panel>

                <Panel
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
                      {passwordError ? (
                        <p className="text-[0.8125rem] text-destructive" role="alert">
                          {passwordError}
                        </p>
                      ) : null}
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
                </Panel>
              </div>
            ) : null}

            {section === 'appearance' ? (
              <Panel
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
              </Panel>
            ) : null}

            {section === 'members' ? (
              <Panel
                title={t('settings.membersTitle')}
                description={t('settings.membersDesc')}
                wide
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
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-[0.8125rem] text-muted-foreground">
                        {t('settings.memberCount', { count: members.length })}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-0 bg-muted/40 ring-1 ring-border/60"
                        onClick={() => {
                          setShowAddMember((v) => !v)
                          setAddError(null)
                        }}
                      >
                        <Plus className="size-3.5" strokeWidth={1.75} />
                        {t('settings.addMember')}
                      </Button>
                    </div>

                    {showAddMember ? (
                      <div
                        className={cn(
                          'mb-4 space-y-4 rounded-2xl bg-card/60 p-4',
                          'ring-1 ring-border/70 dark:bg-card/40',
                        )}
                      >
                        <p className="text-[0.8125rem] font-medium text-foreground">
                          {t('settings.addMemberTitle')}
                        </p>
                        <p className="text-[0.75rem] text-muted-foreground">
                          {t('settings.addMemberHint')}
                        </p>
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
                        {addError ? (
                          <p
                            className="text-[0.8125rem] text-muted-foreground"
                            role="alert"
                          >
                            {addError}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap justify-end gap-2">
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
                        </div>
                      </div>
                    ) : null}

                    {membersQuery.isLoading ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                        <span className="text-[0.8125rem]">{t('common.loading')}</span>
                      </div>
                    ) : membersQuery.isError ? (
                      <p className="py-6 text-center text-[0.875rem] text-muted-foreground">
                        {t('settings.memberErrorGeneric')}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl ring-1 ring-border/70">
                        {members.map((m) => {
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
                                  {resetError ? (
                                    <p
                                      className="text-[0.8125rem] text-destructive"
                                      role="alert"
                                    >
                                      {resetError}
                                    </p>
                                  ) : null}
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
                    <p className="mt-3 text-[0.75rem] text-muted-foreground">
                      {t('settings.membersHint')}
                    </p>
                  </>
                )}
              </Panel>
            ) : null}

            {section === 'retention' ? (
              <Panel
                title={t('settings.retentionTitle')}
                description={t('settings.retentionDesc')}
              >
                {retentionQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                    <span className="text-[0.8125rem]">{t('common.loading')}</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div
                      className={cn(
                        'space-y-3 rounded-2xl bg-card/60 p-5 ring-1 ring-border/70',
                        'dark:bg-card/40',
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[0.8125rem] font-medium text-foreground">
                          {t('settings.storageUsage')}
                        </span>
                        <span className="text-[0.75rem] tabular-nums text-muted-foreground">
                          {formatFileSize(retention?.storageUsedBytes ?? 0)}
                          {' / '}
                          {formatFileSize(retention?.storageQuotaBytes ?? 0)}
                          {` (${storagePct}%)`}
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-muted/60"
                        role="progressbar"
                        aria-valuenow={storagePct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('settings.storageUsage')}
                      >
                        <div
                          className="h-full rounded-full bg-foreground/80 transition-[width] duration-300"
                          style={{ width: `${storagePct}%` }}
                        />
                      </div>
                      <p className="text-[0.75rem] text-muted-foreground">
                        {t('settings.storageHint')}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="text-[0.8125rem] font-medium text-foreground">
                          {t('settings.maxVersions')}
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={maxVersions}
                          onChange={(e) => setMaxVersions(e.target.value)}
                          disabled={!isAdmin || retentionSaving}
                          className={cn(fieldClass, 'h-10')}
                        />
                        <span className="block text-[0.75rem] text-muted-foreground">
                          {t('settings.maxVersionsHint')}
                        </span>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[0.8125rem] font-medium text-foreground">
                          {t('settings.archiveDays')}
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={3650}
                          value={archiveDays}
                          onChange={(e) => setArchiveDays(e.target.value)}
                          disabled={!isAdmin || retentionSaving}
                          className={cn(fieldClass, 'h-10')}
                        />
                        <span className="block text-[0.75rem] text-muted-foreground">
                          {t('settings.archiveDaysHint')}
                        </span>
                      </label>
                    </div>

                    {!isAdmin ? (
                      <p className="text-[0.8125rem] text-muted-foreground">
                        {t('settings.retentionAdminOnly')}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="lg"
                          variant="outline"
                          className="border-0 bg-muted/40 ring-1 ring-border/60"
                          disabled={cleanupRunning || retentionSaving}
                          onClick={() => void runCleanup()}
                        >
                          {cleanupRunning
                            ? t('settings.cleanupRunning')
                            : t('settings.runCleanup')}
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          className="min-w-[6.5rem]"
                          disabled={retentionSaving || cleanupRunning}
                          onClick={() => void saveRetention()}
                        >
                          {retentionSaving
                            ? t('settings.saving')
                            : t('settings.saveRetention')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            ) : null}

            {section === 'danger' ? (
              <Panel
                title={t('settings.dangerTitle')}
                description={t('settings.dangerDesc')}
                danger
              >
                <div
                  className={cn(
                    'space-y-4 rounded-2xl p-5',
                    'bg-destructive/5 ring-1 ring-destructive/20',
                    'dark:bg-destructive/10 dark:ring-destructive/25',
                  )}
                >
                  <div>
                    <p className="text-[0.875rem] font-medium text-foreground">
                      {t('settings.logoutTitle')}
                    </p>
                    <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                      {t('settings.logoutDesc')}
                    </p>
                  </div>

                  {!confirmLogout ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-10 rounded-lg border-0 bg-background/80',
                        'text-destructive ring-1 ring-destructive/30',
                        'hover:bg-destructive/10 hover:text-destructive',
                      )}
                      onClick={() => setConfirmLogout(true)}
                    >
                      {t('auth.logout')}
                    </Button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.8125rem] text-muted-foreground">
                        {t('settings.logoutConfirm')}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-0 bg-muted/40 ring-1 ring-border/60"
                        onClick={() => setConfirmLogout(false)}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        type="button"
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={onLogout}
                      >
                        {t('settings.logoutConfirmAction')}
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  )
}

function Panel({
  title,
  description,
  children,
  danger,
  /** Forms stay form-max; lists (members) can use the full settings column. */
  wide = false,
}: {
  title: string
  description: string
  children: ReactNode
  danger?: boolean
  wide?: boolean
}) {
  return (
    <section className="w-full space-y-5">
      <div className="space-y-1">
        <h2
          className={cn(
            'text-[1.0625rem] font-semibold tracking-tight',
            danger ? 'text-destructive' : 'text-foreground',
          )}
        >
          {title}
        </h2>
        <p className="max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {wide ? children : <FormStack>{children}</FormStack>}
    </section>
  )
}
