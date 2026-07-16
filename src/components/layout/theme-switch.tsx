import { Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/theme-store'
import type { ThemeMode } from '@/types/theme'

const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
]

interface ThemeSwitchProps {
  className?: string
  /** Compact icon-only cycle button for Topbar */
  compact?: boolean
}

export function ThemeSwitch({ className, compact = true }: ThemeSwitchProps) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

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
              'size-9 text-muted-foreground transition-colors duration-hover hover:text-foreground',
              className,
            )}
            onClick={() => setTheme(next)}
            aria-label={`主题：${current.label}，点击切换`}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>主题：{current.label}</TooltipContent>
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
      aria-label="主题"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={theme === value ? 'secondary' : 'ghost'}
          className="h-8 gap-1.5 px-2.5 transition-colors duration-hover"
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
