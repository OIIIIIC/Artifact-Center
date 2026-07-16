import { useEffect, type ReactNode } from 'react'

import { useResolvedTheme } from '@/hooks/use-resolved-theme'

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * Applies resolved light/dark class on <html>.
 * Preference (light | dark | system) lives in theme-store.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const resolved = useResolvedTheme()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.dataset.theme = resolved
    root.style.colorScheme = resolved
  }, [resolved])

  return children
}
