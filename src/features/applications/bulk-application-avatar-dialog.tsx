import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { ApplicationAvatar } from '@/features/applications/application-avatar'
import {
  APPLICATION_ICON_COLORS,
  APPLICATION_ICON_COLOR_TONE,
  APPLICATION_ICON_OPTIONS,
} from '@/features/applications/application-avatar-meta'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiBulkUpdateApplicationAppearance } from '@/services/api'
import type {
  Application,
  ApplicationIconColor,
  ApplicationIconKey,
} from '@/types/application'

export function BulkApplicationAvatarDialog({
  open,
  onOpenChange,
  applications,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applications: Application[]
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [changeIcon, setChangeIcon] = useState(false)
  const [changeColor, setChangeColor] = useState(false)
  const [iconKey, setIconKey] = useState<ApplicationIconKey>('auto')
  const [iconColor, setIconColor] = useState<ApplicationIconColor>('auto')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ordered = useMemo(
    () =>
      [...applications].sort(
        (left, right) =>
          left.region.name.localeCompare(right.region.name) ||
          left.name.localeCompare(right.name),
      ),
    [applications],
  )
  const normalizedQuery = query.trim().toLowerCase()
  const visible = normalizedQuery
    ? ordered.filter((application) =>
        [application.name, application.region.name, application.packageName].some(
          (value) => value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : ordered

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    if (selected.size === 0 || (!changeIcon && !changeColor)) return
    setSaving(true)
    setError(null)
    try {
      const updated = await apiBulkUpdateApplicationAppearance({
        applicationIds: [...selected],
        ...(changeIcon ? { iconKey } : {}),
        ...(changeColor ? { iconColor } : {}),
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      toast.success(t('applications.bulkAvatarSaved', { count: updated }))
      onOpenChange(false)
    } catch (caught) {
      setError(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('applications.bulkAvatarSaveFailed'),
        }),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <ModalContent className="w-[min(58rem,calc(100vw-2rem))]">
        <ModalHeader>
          <ModalTitle>{t('applications.bulkAvatarTitle')}</ModalTitle>
          <ModalDescription>{t('applications.bulkAvatarDescription')}</ModalDescription>
        </ModalHeader>
        <ModalBody className="grid gap-5 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0 space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('applications.bulkAvatarSearch')}
                aria-label={t('applications.bulkAvatarSearch')}
                className="pl-9"
              />
            </label>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t('applications.bulkAvatarSelected', { count: selected.size })}
              </span>
              <button
                type="button"
                className="font-medium hover:text-foreground"
                onClick={() => {
                  const visibleIds = visible.map((application) => application.id)
                  const allSelected = visibleIds.every((id) => selected.has(id))
                  setSelected((current) => {
                    const next = new Set(current)
                    visibleIds.forEach((id) =>
                      allSelected ? next.delete(id) : next.add(id),
                    )
                    return next
                  })
                }}
              >
                {t('applications.bulkAvatarSelectVisible')}
              </button>
            </div>
            <div className="max-h-[28rem] divide-y divide-border/60 overflow-y-auto rounded-xl ring-1 ring-border/70">
              {visible.map((application) => {
                const active = selected.has(application.id)
                return (
                  <button
                    key={application.id}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() => toggle(application.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/35"
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border-strong',
                      )}
                    >
                      {active ? <Check className="size-3" /> : null}
                    </span>
                    <ApplicationAvatar
                      application={application}
                      className="size-8"
                      iconClassName="size-4"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {application.name}
                      </span>
                      <span className="block truncate text-[0.6875rem] text-muted-foreground">
                        {application.region.name}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <AppearanceToggle
              active={changeIcon}
              label={t('applications.bulkAvatarChangeIcon')}
              onClick={() => setChangeIcon((value) => !value)}
            />
            {changeIcon ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {APPLICATION_ICON_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.key}
                      type="button"
                      title={t(`appAppearance.icons.${option.key}`)}
                      aria-pressed={iconKey === option.key}
                      onClick={() => setIconKey(option.key)}
                      className={cn(
                        'flex h-12 items-center justify-center rounded-xl ring-1',
                        iconKey === option.key
                          ? 'bg-foreground text-background ring-foreground'
                          : 'bg-muted/20 text-muted-foreground ring-border/70 hover:text-foreground',
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                    </button>
                  )
                })}
              </div>
            ) : null}

            <AppearanceToggle
              active={changeColor}
              label={t('applications.bulkAvatarChangeColor')}
              onClick={() => setChangeColor((value) => !value)}
            />
            {changeColor ? (
              <div className="flex flex-wrap gap-2">
                {APPLICATION_ICON_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={t(`appAppearance.colors.${color}`)}
                    aria-pressed={iconColor === color}
                    onClick={() => setIconColor(color)}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-xl ring-1',
                      color === 'auto'
                        ? 'bg-muted text-muted-foreground'
                        : APPLICATION_ICON_COLOR_TONE[color],
                      iconColor === color
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                        : 'ring-border/60',
                    )}
                  >
                    {iconColor === color ? <Check className="size-4" /> : null}
                    <span className="sr-only">{t(`appAppearance.colors.${color}`)}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('applications.bulkAvatarHint')}
            </p>
            {error ? <FormError message={error} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={saving || selected.size === 0 || (!changeIcon && !changeColor)}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {saving
              ? t('applications.bulkAvatarSaving')
              : t('applications.bulkAvatarSave')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function AppearanceToggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex items-center gap-2 text-sm font-medium"
    >
      <span
        className={cn(
          'flex size-4 items-center justify-center rounded border',
          active
            ? 'border-foreground bg-foreground text-background'
            : 'border-border-strong',
        )}
      >
        {active ? <Check className="size-3" /> : null}
      </span>
      {label}
    </button>
  )
}
