import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enUS from '@/i18n/locales/en-US.json'
import zhCN from '@/i18n/locales/zh-CN.json'
import { DEFAULT_LOCALE, type AppLocale } from '@/types/locale'

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export function applyDocumentLocale(locale: AppLocale) {
  document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en'
}

applyDocumentLocale(DEFAULT_LOCALE)

export default i18n
