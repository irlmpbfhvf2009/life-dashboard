import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zhTW from './locales/zh-TW'
import zhCN from './locales/zh-CN'
import ja from './locales/ja'
import ko from './locales/ko'
import th from './locales/th'
// AI English Coach UI-chrome strings (namespace `ec`), kept in their own files
// to avoid bloating the main locale modules.
import ecEn from './locales/english/en'
import ecZhTW from './locales/english/zh-TW'
import ecZhCN from './locales/english/zh-CN'
import ecJa from './locales/english/ja'
import ecKo from './locales/english/ko'
import ecTh from './locales/english/th'
// Travel module UI strings (namespace `tv`), kept in their own files.
import tvEn from './locales/travel/en'
import tvZhTW from './locales/travel/zh-TW'
import tvZhCN from './locales/travel/zh-CN'
import tvJa from './locales/travel/ja'
import tvKo from './locales/travel/ko'
import tvTh from './locales/travel/th'

export type Locale = 'zh-TW' | 'zh-CN' | 'en' | 'ja' | 'ko' | 'th'

/** Display metadata for the language switcher. Order = menu order. */
export const localeOptions: { code: Locale; label: string; flag: string }[] = [
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
]

const SUPPORTED = localeOptions.map((o) => o.code)
const STORAGE_KEY = 'locale'

function detectInitialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && SUPPORTED.includes(saved as Locale)) return saved as Locale
  const lang = navigator.language?.toLowerCase() ?? ''
  if (lang.startsWith('zh')) {
    // zh-cn / zh-hans / zh-sg → Simplified, otherwise Traditional.
    return /cn|hans|sg/.test(lang) ? 'zh-CN' : 'zh-TW'
  }
  if (lang.startsWith('ja')) return 'ja'
  if (lang.startsWith('ko')) return 'ko'
  if (lang.startsWith('th')) return 'th'
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true, // enables $t in every template without imports
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    'zh-TW': { ...zhTW, ec: ecZhTW, ...tvZhTW },
    'zh-CN': { ...zhCN, ec: ecZhCN, ...tvZhCN },
    en: { ...en, ec: ecEn, ...tvEn },
    ja: { ...ja, ec: ecJa, ...tvJa },
    ko: { ...ko, ec: ecKo, ...tvKo },
    th: { ...th, ec: ecTh, ...tvTh },
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
