import { KeyRound, Shield } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormError } from '@/components/feedback'
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
import { useAuthStore } from '@/store/auth-store'
import { AvatarUpload } from './avatar-upload'
import { MEMBER_ROLES, type MemberRole } from './mock-members'
import { PasswordField, PasswordPolicyHints } from './password-field'

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
  const [passwordOpen, setPasswordOpen] = useState(false)

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
    setPasswordOpen(false)
  }

  const onPasswordOpenChange = (open: boolean) => {
    if (!open && passwordSaving) return
    setPasswordOpen(open)
    if (!open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError(null)
    }
  }

  return (
    <div className="max-w-[44rem] space-y-6">
      <section className="min-w-0 rounded-2xl bg-card/60 p-5 ring-1 ring-border/70 sm:p-6 dark:bg-card/40 dark:ring-border/80">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[1.0625rem] font-semibold tracking-tight text-foreground">
              {t('settings.generalTitle')}
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {t('settings.generalDesc')}
            </p>
          </div>
        </header>

        <div className="mt-6 grid min-w-0 gap-6 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
          <AvatarUpload
            name={user?.name ?? profileName}
            avatarUrl={user?.avatarUrl}
            onChange={onAvatarChange}
            disabled={profileSaving}
            className="sm:flex-col sm:items-start [&>button]:size-20 [&_[data-slot=avatar]]:size-20"
          />

          <form
            className="min-w-0 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void saveProfile()
            }}
          >
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
            <dl className="grid gap-3 rounded-xl bg-muted/25 px-4 py-3 ring-1 ring-border/50 sm:grid-cols-2 dark:bg-muted/10">
              <div className="min-w-0">
                <dt className="text-[0.75rem] text-muted-foreground">
                  {t('settings.fieldUsername')}
                </dt>
                <dd className="mt-1 truncate text-[0.8125rem] font-medium text-foreground">
                  {user?.username ?? '—'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.75rem] text-muted-foreground">
                  {t('settings.fieldRole')}
                </dt>
                <dd className="mt-1">
                  <Badge variant="secondary" className="gap-1 rounded-md font-normal">
                    <Shield className="size-3 opacity-70" strokeWidth={1.75} />
                    {user && MEMBER_ROLES.includes(user.role)
                      ? roleLabel(user.role)
                      : '—'}
                  </Badge>
                </dd>
              </div>
            </dl>
            <FormError message={profileError} />
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="lg"
                className="min-w-[6.5rem]"
                disabled={profileSaving || !profileDirty}
              >
                {profileSaving ? t('settings.saving') : t('settings.saveProfile')}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl bg-card/60 p-5 ring-1 ring-border/70 sm:p-6 dark:bg-card/40 dark:ring-border/80">
        <header>
          <h2 className="text-[1.0625rem] font-semibold tracking-tight text-foreground">
            {t('settings.passwordTitle')}
          </h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t('settings.passwordDesc')}
          </p>
        </header>

        <div className="mt-5 flex flex-col items-stretch gap-3 rounded-xl bg-muted/25 px-4 py-3 ring-1 ring-border/50 sm:flex-row sm:items-center dark:bg-muted/10">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            aria-hidden
          >
            <KeyRound className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] font-medium text-foreground">
              {t('settings.passwordMethodTitle')}
            </p>
            <p className="mt-0.5 text-[0.75rem] leading-relaxed text-muted-foreground">
              {t('settings.passwordMethodDesc')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 sm:self-center"
            onClick={() => setPasswordOpen(true)}
          >
            {t('settings.changePassword')}
          </Button>
        </div>
      </section>

      <Modal open={passwordOpen} onOpenChange={onPasswordOpenChange}>
        <ModalContent className="w-[min(30rem,calc(100vw-2rem))]">
          <ModalHeader>
            <ModalTitle>{t('settings.changePassword')}</ModalTitle>
            <ModalDescription>{t('settings.passwordLead')}</ModalDescription>
          </ModalHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              void onChangePassword()
            }}
          >
            <ModalBody className="space-y-4">
              <PasswordField
                id="current-password"
                label={t('settings.fieldCurrentPassword')}
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                disabled={passwordSaving}
              />
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
              <PasswordPolicyHints />
              <FormError message={passwordError} />
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={passwordSaving}
                onClick={() => onPasswordOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="min-w-[7rem]"
                disabled={
                  passwordSaving || !currentPassword || !newPassword || !confirmPassword
                }
              >
                {passwordSaving
                  ? t('settings.changingPassword')
                  : t('settings.changePassword')}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  )
}
