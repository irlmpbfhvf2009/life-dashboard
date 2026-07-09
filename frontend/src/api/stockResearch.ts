import type { AnalysisData, PerformanceData, ArchiveData, ResultData } from '@/types/stock'

// The AI stock-research pipeline (Python scan + scoring + tracking) lives in
// this repo under /stock-radar and a GitHub Action commits fresh JSON daily.
// The frontend reads it straight from GitHub raw, so the deployed Studio always
// shows the latest analysis with no rebuild/redeploy needed (and it's free —
// raw.githubusercontent.com serves with `access-control-allow-origin: *`).
const BASE =
  import.meta.env.VITE_STOCK_DATA_BASE ||
  'https://raw.githubusercontent.com/irlmpbfhvf2009/life-dashboard/main/stock-radar/public'
// Fallback CDN (same GitHub content, far more generous rate limits) for when
// raw.githubusercontent.com rate-limits this IP with a 429.
const FALLBACK_BASE =
  'https://cdn.jsdelivr.net/gh/irlmpbfhvf2009/life-dashboard@main/stock-radar/public'

async function getJson<T>(file: string): Promise<T> {
  // Coarse (per-minute) cache-bust: fresh enough for a once-daily commit, while
  // letting GitHub's CDN serve repeated hits within the same minute. A unique
  // per-request timestamp (Date.now()) bypassed the CDN entirely and hammered
  // raw.githubusercontent.com into 429 rate-limits on refresh. The changing
  // minute bucket still sidesteps GitHub raw's 404 negative-cache (gotcha #4).
  const bucket = Math.floor(Date.now() / 60_000)
  try {
    const res = await fetch(`${BASE}/${file}?t=${bucket}`)
    if (!res.ok) throw new Error(`無法載入 ${file}（${res.status}）`)
    return (await res.json()) as T
  } catch (primaryErr) {
    // raw 429 / network hiccup → fall back to jsDelivr (query string ignored by
    // its CDN, so no per-minute bucket needed).
    const res = await fetch(`${FALLBACK_BASE}/${file}`)
    if (!res.ok) throw primaryErr
    return (await res.json()) as T
  }
}

export const stockResearchApi = {
  analysis: () => getJson<AnalysisData>('analysis.json'),
  performance: () => getJson<PerformanceData>('ai_performance.json'),
  archive: () => getJson<ArchiveData>('analysis_archive.json'),
  result: () => getJson<ResultData>('result.json'),
}
