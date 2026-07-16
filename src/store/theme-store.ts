import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ThemeMode } from '@/types/theme'

const STORAGE_KEY = 'artifact-center-theme'

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: STORAGE_KEY },
  ),
)
