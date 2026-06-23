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

export const MOOD_EMOJI: Record<number, string> = {
  1: '😞',
  2: '🙁',
  3: '😐',
  4: '🙂',
  5: '😄',
}
