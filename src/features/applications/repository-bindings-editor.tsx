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
import type { Application } from '@/types/application'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type Bindings = NonNullable<Application['repositoryBindings']>

export function RepositoryBindingsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: Bindings
  onChange?: (value: Bindings) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null)
  const bindingToRemove = pendingRemoval === null ? null : value[pendingRemoval]
  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <h3 className="text-sm font-medium">{t('repositoryBindings.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('repositoryBindings.hint')}</p>
      </div>
      {value.length === 0 && !onChange && (
        <p className="text-sm text-muted-foreground">{t('repositoryBindings.empty')}</p>
      )}
      {value.map((binding, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-xl border border-border/70 bg-muted/10 p-4 sm:grid-cols-2"
        >
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t('repositoryBindings.itemLabel', { index: index + 1 })}
            </p>
            {onChange && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={disabled}
                onClick={() => setPendingRemoval(index)}
              >
                <Trash2 />
                {t('repositoryBindings.remove')}
              </Button>
            )}
          </div>
          {(['repository', 'branch', 'directory'] as const).map((field) => (
            <label
              key={field}
              className={field === 'repository' ? 'space-y-1 sm:col-span-2' : 'space-y-1'}
            >
              <span className="text-xs text-muted-foreground">
                {t(`repositoryBindings.${field}`)}
              </span>
              {onChange ? (
                <Input
                  aria-label={`${t(`repositoryBindings.${field}`)} ${index + 1}`}
                  value={binding[field]}
                  disabled={disabled}
                  maxLength={field === 'branch' ? 255 : 500}
                  placeholder={
                    field === 'directory' ? t('repositoryBindings.root') : undefined
                  }
                  onChange={(event) =>
                    onChange(
                      value.map((item, i) =>
                        i === index ? { ...item, [field]: event.target.value } : item,
                      ),
                    )
                  }
                />
              ) : (
                <p className="break-all text-sm font-mono">
                  {binding[field] || t('repositoryBindings.root')}
                </p>
              )}
            </label>
          ))}
        </div>
      ))}
      {onChange && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || value.length >= 20}
          onClick={() =>
            onChange([...value, { repository: '', branch: '', directory: '' }])
          }
        >
          {t('repositoryBindings.add')}
        </Button>
      )}
      <Modal
        open={bindingToRemove !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <ModalContent className="w-[min(32rem,calc(100vw-2rem))]" showClose={false}>
          <ModalHeader>
            <ModalTitle>{t('repositoryBindings.removeTitle')}</ModalTitle>
            <ModalDescription>
              {t('repositoryBindings.removeDescription')}
            </ModalDescription>
          </ModalHeader>
          {bindingToRemove ? (
            <ModalBody>
              <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="break-all font-mono text-sm">
                  {bindingToRemove.repository}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bindingToRemove.branch} ·{' '}
                  {bindingToRemove.directory || t('repositoryBindings.root')}
                </p>
              </div>
            </ModalBody>
          ) : null}
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRemoval(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingRemoval !== null)
                  onChange?.(value.filter((_, i) => i !== pendingRemoval))
                setPendingRemoval(null)
              }}
            >
              <Trash2 />
              {t('repositoryBindings.confirmRemove')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
