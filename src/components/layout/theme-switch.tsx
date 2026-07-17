import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/theme-store'
import type { ThemeMode } from '@/types/theme'

interface ThemeSwitchProps {
  className?: string
  compact?: boolean
}

export function ThemeSwitch({ className, compact = true }: ThemeSwitchProps) {
  const { t } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('common.themeLight'), icon: Sun },
    { value: 'dark', label: t('common.themeDark'), icon: Moon },
    { value: 'system', label: t('common.themeSystem'), icon: Monitor },
  ]

  if (compact) {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    const current = options.find((o) => o.value === theme) ?? options[2]
    const Icon = current.icon

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
            onClick={() => setTheme(next)}
            aria-label={t('common.themeAria', { label: current.label })}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t('common.theme')}: {current.label}
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
      aria-label={t('common.theme')}
    >
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={theme === value ? 'secondary' : 'ghost'}
          className="h-8 gap-1.5 px-2.5 transition-colors duration-[var(--duration-hover)]"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
        >
          <Icon className="size-3.5" strokeWidth={1.75} />
          <span className="text-caption">{label}</span>
        </Button>
      ))}
    </div>
  )
}
