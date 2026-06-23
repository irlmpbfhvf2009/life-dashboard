import { i18n } from '@/i18n'

// Date/number formatting follows the active UI language.
function loc(): string {
  return i18n.global.locale.value
}

const CURRENCY: Record<string, string> = { 'zh-TW': 'TWD', en: 'USD' }

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Accept both LocalDate ("2026-06-23") and Instant ("...T...Z").
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(loc(), { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(loc(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—'
  const currency = CURRENCY[loc()] ?? 'USD'
  return new Intl.NumberFormat(loc(), {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'TWD' ? 0 : 2,
  }).format(amount)
}

export function todayISO(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

// Sentiment keyword highlighting for AI commentary. Uses indigo (positive) and
// amber (caution) — deliberately NOT red/green so it never clashes with the
// price up/down convention. Returns safe HTML (base text is escaped first).
const POSITIVE_TERMS = ['改善', '轉機', '轉盈', '超預期', '利多', '回升', '跳升', '轉強', '成長', '強勢', '突破']
const CAUTION_TERMS = ['惡化', '過熱', '乖離', '拋物線', '追高', '偏貴', '轉弱', '賣壓', '過大', '風險', '套牢']

export function highlightTerms(text: string | null | undefined): string {
  if (!text) return ''
  const esc = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)
  const all = [...POSITIVE_TERMS, ...CAUTION_TERMS]
  const pos = new Set(POSITIVE_TERMS)
  const re = new RegExp(`(${all.join('|')})`, 'g')
  return esc.replace(re, (m) => {
    const cls = pos.has(m)
      ? 'font-semibold text-brand-600 dark:text-brand-300'
      : 'font-semibold text-amber-600 dark:text-amber-400'
    return `<span class="${cls}">${m}</span>`
  })
}

/**
 * Taiwan stock-market colour convention: 漲(up)=red, 跌(down)=green.
 * Returns a Tailwind text-colour class for a numeric change/return.
 */
export function twPriceClass(n: number | null | undefined): string {
  if (n == null || n === 0) return 'text-ink-500'
  return n > 0 ? 'text-rose-600' : 'text-emerald-600'
}

export const MOOD_EMOJI: Record<number, string> = {
  1: '😞',
  2: '🙁',
  3: '😐',
  4: '🙂',
  5: '😄',
}
