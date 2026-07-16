import { useEffect, useState } from 'react'

import { useThemeStore } from '@/store/theme-store'
import type { ResolvedTheme } from '@/types/theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(theme: 'light' | 'dark' | 'system'): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

export function useResolvedTheme(): ResolvedTheme {
  const theme = useThemeStore((s) => s.theme)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(theme))

  useEffect(() => {
    const update = () => setResolved(resolveTheme(theme))
    update()

    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])

  return resolved
}
