import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { checkPassword } from '@/lib/password'
import { queryKeys } from '@/lib/query-keys'
import { apiAdminResetPassword, type TeamMemberDto } from '@/services/api'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getMemberErrorMessage } from './member-error'
import { PasswordField } from './password-field'

export function ResetMemberPasswordForm({
  member,
  onClose,
}: {
  member: TeamMemberDto
  onClose: () => void
}) {
  const { t } = useTranslation()
  const errorMessage = (error: unknown) => getMemberErrorMessage(error, t)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const mutationKey = queryKeys.users.resetPassword
  const resetting = useIsMutating({ mutationKey }) > 0
  const resetMutation = useMutation({
    mutationKey,
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiAdminResetPassword(id, password),
  })
  const resetMemberPassword = async (id: string, memberName: string) => {
    // The request outlives this form when it is closed or another member is selected.
    if (queryClient.isMutating({ mutationKey }) > 0) return
    setResetError(null)
    if (!resetPassword || !resetConfirm)
      return setResetError(t('settings.passwordErrorEmpty'))
    if (resetPassword !== resetConfirm)
      return setResetError(t('settings.passwordErrorMismatch'))
    if (!checkPassword(resetPassword, { confirm: resetConfirm }).ok)
      return setResetError(t('settings.passwordErrorWeak'))
    try {
      await resetMutation.mutateAsync({ id, password: resetPassword })
      onClose()
      setResetPassword('')
      setResetConfirm('')
      toast.success(t('settings.passwordReset'), {
        description: t('settings.passwordResetDesc', { name: memberName }),
      })
    } catch (error) {
      setResetError(errorMessage(error))
    }
  }
  return (
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
        <Button type="button" variant="outline" onClick={() => onClose()}>
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          disabled={resetting || !resetPassword || !resetConfirm}
          onClick={() => void resetMemberPassword(member.id, member.name)}
        >
          {resetting
            ? t('settings.resettingPassword')
            : t('settings.confirmResetPassword')}
        </Button>
      </div>
    </div>
  )
}
