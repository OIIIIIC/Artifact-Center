import { UserAvatar } from '@/components/common/user-avatar'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { apiTransferAdministrator, type TeamMemberDto } from '@/services/api'
import { useAuthStore } from '@/store/auth-store'
import { ArrowRightLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getMemberErrorMessage } from './member-error'
import { type MemberRole } from './member-roles'

export function TransferAdministratorDialog({
  transferCandidates,
}: {
  transferCandidates: TeamMemberDto[]
}) {
  const { t } = useTranslation()
  const errorMessage = (error: unknown) => getMemberErrorMessage(error, t)
  const roleLabel = (value: MemberRole) => t(`settings.role.${value}`)
  const logout = useAuthStore((state) => state.logout)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferRole, setTransferRole] = useState<'maintainer' | 'viewer'>('viewer')
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferring, setTransferring] = useState(false)
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
  return (
    <>
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
    </>
  )
}
