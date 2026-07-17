import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import i18n, { applyDocumentLocale } from '@/i18n'
import { DEFAULT_LOCALE, type AppLocale } from '@/types/locale'

interface LocaleState {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => {
        void i18n.changeLanguage(locale)
        applyDocumentLocale(locale)
        set({ locale })
      },
    }),
    {
      name: 'artifact-center-locale',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        void i18n.changeLanguage(state.locale)
        applyDocumentLocale(state.locale)
      },
    },
  ),
)
