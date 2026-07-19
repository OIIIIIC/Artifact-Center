import { Languages, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { useLocaleStore } from '@/store/locale-store'
import { useThemeStore } from '@/store/theme-store'
import { LOCALE_LABEL, type AppLocale } from '@/types/locale'
import type { ThemeMode } from '@/types/theme'
import { SettingsPanel } from './settings-panel'

const THEME_OPTIONS: Array<{
  value: ThemeMode
  icon: typeof Sun
  labelKey: 'themeLight' | 'themeDark' | 'themeSystem'
}> = [
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
]
const LOCALE_OPTIONS: AppLocale[] = ['zh-CN', 'en-US']

function chipClass(active: boolean) {
  return cn(
    'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-[var(--duration-hover)]',
    active
      ? 'bg-foreground text-background'
      : 'bg-muted/40 text-muted-foreground hover:text-foreground',
  )
}

export function AppearanceSettingsPanel() {
  const { t } = useTranslation()
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  const locale = useLocaleStore((state) => state.locale)
  const setLocale = useLocaleStore((state) => state.setLocale)

  return (
    <SettingsPanel
      title={t('settings.appearanceTitle')}
      description={t('settings.appearanceDesc')}
    >
      <div className="space-y-6">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-foreground">
            <Sun className="size-3.5 opacity-70" strokeWidth={1.75} />
            {t('common.theme')}
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t('common.theme')}
          >
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  chipClass(theme === value),
                  'inline-flex items-center gap-1.5',
                )}
                aria-pressed={theme === value}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                {t(`common.${labelKey}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-foreground">
            <Languages className="size-3.5 opacity-70" strokeWidth={1.75} />
            {t('common.language')}
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t('common.language')}
          >
            {LOCALE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLocale(value)}
                className={chipClass(locale === value)}
                aria-pressed={locale === value}
              >
                {LOCALE_LABEL[value]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SettingsPanel>
  )
}
