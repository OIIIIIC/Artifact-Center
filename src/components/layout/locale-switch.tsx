import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useLocaleStore } from '@/store/locale-store'
import { LOCALE_LABEL, type AppLocale } from '@/types/locale'

const ORDER: AppLocale[] = ['zh-CN', 'en-US']

interface LocaleSwitchProps {
  className?: string
  compact?: boolean
}

export function LocaleSwitch({ className, compact = true }: LocaleSwitchProps) {
  const { t } = useTranslation()
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  if (compact) {
    const next = ORDER[(ORDER.indexOf(locale) + 1) % ORDER.length]
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'size-9 text-muted-foreground transition-colors duration-[var(--duration-hover)] hover:text-foreground',
              className,
            )}
            onClick={() => setLocale(next)}
            aria-label={`${t('common.language')}: ${LOCALE_LABEL[locale]}`}
          >
            <Languages className="size-4" strokeWidth={1.75} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t('common.language')}: {LOCALE_LABEL[locale]} → {LOCALE_LABEL[next]}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5',
        className,
      )}
      role="group"
      aria-label={t('common.language')}
    >
      {ORDER.map((value) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={locale === value ? 'secondary' : 'ghost'}
          className="h-8 gap-1.5 px-2.5 transition-colors duration-[var(--duration-hover)]"
          onClick={() => setLocale(value)}
          aria-pressed={locale === value}
        >
          <span className="text-caption">{LOCALE_LABEL[value]}</span>
        </Button>
      ))}
    </div>
  )
}
