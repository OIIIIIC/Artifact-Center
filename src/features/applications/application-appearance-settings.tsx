import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Palette } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { ApplicationAvatar } from '@/features/applications/application-avatar'
import {
  APPLICATION_ICON_COLORS,
  APPLICATION_ICON_COLOR_TONE,
  APPLICATION_ICON_OPTIONS,
} from '@/features/applications/application-avatar-meta'
import { queryKeys } from '@/lib/query-keys'
import { getRequestErrorMessage } from '@/lib/request-error'
import { cn } from '@/lib/utils'
import { apiUpdateApplication } from '@/services/api'
import type {
  Application,
  ApplicationIconColor,
  ApplicationIconKey,
} from '@/types/application'

export function ApplicationAppearanceSettings({
  application,
}: {
  application: Application
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [iconKey, setIconKey] = useState<ApplicationIconKey>(
    application.iconKey ?? 'auto',
  )
  const [iconColor, setIconColor] = useState<ApplicationIconColor>(
    application.iconColor ?? 'auto',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty =
    iconKey !== (application.iconKey ?? 'auto') ||
    iconColor !== (application.iconColor ?? 'auto')

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    setError(null)
    try {
      const updated = await apiUpdateApplication(application.id, { iconKey, iconColor })
      queryClient.setQueryData(queryKeys.applications.detail(application.id), updated)
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      toast.success(t('appAppearance.saved'))
    } catch (caught) {
      setError(
        getRequestErrorMessage(caught, {
          offline: t('common.requestFailedOffline'),
          unavailable: t('common.requestFailedUnavailable'),
          fallback: t('appAppearance.saveFailed'),
        }),
      )
    } finally {
      setSaving(false)
    }
  }

  const preview = { ...application, iconKey, iconColor }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[0.9375rem] font-semibold text-foreground">
          {t('appAppearance.title')}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {t('appAppearance.description')}
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-muted/20 p-5 ring-1 ring-border/60">
        <ApplicationAvatar
          application={preview}
          className="size-16 rounded-2xl"
          iconClassName="size-7"
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{application.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('appAppearance.previewHint')}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-[0.8125rem] font-medium">{t('appAppearance.icon')}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('appAppearance.iconHint')}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {APPLICATION_ICON_OPTIONS.map((option) => {
            const Icon = option.icon
            const active = iconKey === option.key
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                title={t(`appAppearance.icons.${option.key}`)}
                onClick={() => setIconKey(option.key)}
                className={cn(
                  'relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground ring-1 transition-colors',
                  active
                    ? 'bg-foreground text-background ring-foreground'
                    : 'bg-muted/20 ring-border/70 hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                <span className="max-w-full truncate px-1 text-[0.625rem]">
                  {t(`appAppearance.icons.${option.key}`)}
                </span>
                {active ? <Check className="absolute top-1.5 right-1.5 size-3" /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-[0.8125rem] font-medium">{t('appAppearance.color')}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('appAppearance.colorHint')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {APPLICATION_ICON_COLORS.map((color) => {
            const active = iconColor === color
            return (
              <button
                key={color}
                type="button"
                aria-pressed={active}
                title={t(`appAppearance.colors.${color}`)}
                onClick={() => setIconColor(color)}
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl ring-1 transition-transform hover:scale-105',
                  color === 'auto'
                    ? 'bg-muted text-muted-foreground'
                    : APPLICATION_ICON_COLOR_TONE[color],
                  active
                    ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                    : 'ring-border/60',
                )}
              >
                {color === 'auto' ? (
                  <Palette className="size-4" />
                ) : active ? (
                  <Check className="size-4" />
                ) : null}
                <span className="sr-only">{t(`appAppearance.colors.${color}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {error ? <FormError message={error} /> : null}
      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {saving ? t('appAppearance.saving') : t('appAppearance.save')}
        </Button>
      </div>
    </section>
  )
}
