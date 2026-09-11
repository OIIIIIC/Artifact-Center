import { FormError } from '@/components/feedback'
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
import { checkPassword } from '@/lib/password'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { apiCreateUser } from '@/services/api'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getMemberErrorMessage } from './member-error'
import { MEMBER_ROLES, type MemberRole } from './member-roles'
import { PasswordField } from './password-field'

export function CreateMemberDialog() {
  const { t } = useTranslation()
  const errorMessage = (error: unknown) => getMemberErrorMessage(error, t)
  const roleLabel = (value: MemberRole) => t(`settings.role.${value}`)
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
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
  return (
    <>
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
    </>
  )
}
