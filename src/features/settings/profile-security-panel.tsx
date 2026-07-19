import { KeyRound, Shield } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormError } from '@/components/feedback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth-store'
import { AvatarUpload } from './avatar-upload'
import { MEMBER_ROLES, type MemberRole } from './mock-members'
import { PasswordField, PasswordPolicyHints } from './password-field'
import { SettingsPanel } from './settings-panel'

export function ProfileSecurityPanel() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const updateAvatar = useAuthStore((state) => state.updateAvatar)
  const changePassword = useAuthStore((state) => state.changePassword)
  const [profileName, setProfileName] = useState(() => user?.name ?? '')
  const [profileEmail, setProfileEmail] = useState(() => user?.email ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const roleLabel = (role: MemberRole) => t(`settings.role.${role}`)
  const profileDirty =
    profileName.trim() !== (user?.name ?? '') ||
    profileEmail.trim() !== (user?.email ?? '')

  const saveProfile = async () => {
    setProfileError(null)
    setProfileSaving(true)
    const result = await updateProfile({ name: profileName, email: profileEmail })
    setProfileSaving(false)
    if (!result.ok) {
      setProfileError(
        result.code === 'invalid_email'
          ? t('settings.profileErrorEmail')
          : t('settings.profileErrorEmpty'),
      )
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

  return (
    <div className="space-y-8">
      <SettingsPanel
        title={t('settings.generalTitle')}
        description={t('settings.generalDesc')}
      >
        <div className="space-y-5 rounded-2xl bg-card/60 p-5 ring-1 ring-border/70 dark:bg-card/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <AvatarUpload
              name={user?.name ?? profileName}
              avatarUrl={user?.avatarUrl}
              onChange={onAvatarChange}
              disabled={profileSaving}
            />
            <div className="sm:text-right">
              <Badge variant="secondary" className="gap-1 rounded-md font-normal">
                <Shield className="size-3 opacity-70" strokeWidth={1.75} />
                {user && MEMBER_ROLES.includes(user.role) ? roleLabel(user.role) : '—'}
              </Badge>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.fieldName')}
              </span>
              <Input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                className="h-10 rounded-lg"
                disabled={profileSaving}
                autoComplete="name"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {t('settings.fieldEmail')}
              </span>
              <Input
                type="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
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
        <div className="overflow-hidden rounded-2xl bg-card/60 ring-1 ring-border/70 dark:bg-card/40 dark:ring-border/80">
          <div className="flex items-start gap-3 border-b border-border/60 bg-muted/20 px-5 py-3.5 dark:bg-muted/10">
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
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
            <div className="flex justify-end border-t border-border/50 pt-4">
              <Button
                type="button"
                size="lg"
                className="min-w-[7rem]"
                disabled={
                  passwordSaving || !currentPassword || !newPassword || !confirmPassword
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
  )
}
