/**
 * Turn a caught error into a short, user-facing zh-TW message instead of
 * surfacing the raw axios/JS error text (e.g. "Network Error") in the UI.
 * Falls back to the original message when nothing more specific matches.
 */
export function friendlyError(e: unknown, fallback = '發生未知錯誤，請稍後再試'): string {
  const err = e as { message?: unknown; response?: { status?: number } } | undefined
  const status = err?.response?.status
  if (status === 401) return '登入已過期，請重新整理頁面並重新登入'
  if (status === 403) return '沒有權限執行此操作'
  if (status === 404) return '找不到資料'
  if (status && status >= 500) return '伺服器暫時發生問題，請稍後再試'

  const message = typeof err?.message === 'string' ? err.message : ''
  if (/network error/i.test(message)) return '無法連線，請確認網路狀態後再試'
  if (/timeout/i.test(message)) return '連線逾時，請稍後再試'

  return message || fallback
}
