import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zhTW from './locales/zh-TW'

export type Locale = 'zh-TW' | 'en'

const STORAGE_KEY = 'locale'

function detectInitialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'zh-TW') return saved
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true, // enables $t in every template without imports
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    'zh-TW': zhTW,
    en,
  },
})

/** Switch the active language and persist the choice. */
export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}

/** Current active language. */
export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}

// Apply on load so <html lang> matches.
document.documentElement.setAttribute('lang', currentLocale())
