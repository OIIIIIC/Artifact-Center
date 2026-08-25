import { Braces, Images, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal'
import { BulkApplicationAvatarDialog } from '@/features/applications/bulk-application-avatar-dialog'
import { BulkApplicationCodeDialog } from '@/features/applications/bulk-application-code-dialog'
import type { Application } from '@/types/application'

type BulkAction = 'menu' | 'codes' | 'avatar'

export function BulkApplicationActionsDialog({
  open,
  onOpenChange,
  applications,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applications: Application[]
}) {
  const { t } = useTranslation()
  const [action, setAction] = useState<BulkAction>('menu')

  if (action === 'codes') {
    return (
      <BulkApplicationCodeDialog
        open={open}
        applications={applications}
        onOpenChange={onOpenChange}
      />
    )
  }
  if (action === 'avatar') {
    return (
      <BulkApplicationAvatarDialog
        open={open}
        applications={applications}
        onOpenChange={onOpenChange}
      />
    )
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="w-[min(36rem,calc(100vw-2rem))]">
        <ModalHeader>
          <ModalTitle>{t('applications.bulkActionsTitle')}</ModalTitle>
          <ModalDescription>{t('applications.bulkActionsDescription')}</ModalDescription>
        </ModalHeader>
        <ModalBody className="grid gap-3 sm:grid-cols-2">
          <ActionCard
            icon={Braces}
            title={t('applications.bulkCodeTitle')}
            description={t('applications.bulkCodeDescription')}
            onClick={() => setAction('codes')}
          />
          <ActionCard
            icon={Images}
            title={t('applications.bulkAvatarTitle')}
            description={t('applications.bulkAvatarDescription')}
            onClick={() => setAction('avatar')}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-muted/25 p-4 text-left ring-1 ring-border/70 transition-colors hover:bg-muted/50"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border/60">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="mt-3 block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
        {description}
      </span>
    </button>
  )
}
