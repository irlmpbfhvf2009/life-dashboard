import type { AnalysisData, PerformanceData, ArchiveData, ResultData } from '@/types/stock'

// The AI stock-research pipeline (Python scan + scoring + tracking) lives in
// this repo under /stock-radar and a GitHub Action commits fresh JSON daily.
// The frontend reads it straight from GitHub raw, so the deployed Studio always
// shows the latest analysis with no rebuild/redeploy needed (and it's free —
// raw.githubusercontent.com serves with `access-control-allow-origin: *`).
const BASE =
  import.meta.env.VITE_STOCK_DATA_BASE ||
  'https://raw.githubusercontent.com/irlmpbfhvf2009/life-dashboard/main/stock-radar/public'

async function getJson<T>(file: string): Promise<T> {
  // Cache-bust so a fresh daily commit shows up without a hard refresh.
  const res = await fetch(`${BASE}/${file}?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`無法載入 ${file}（${res.status}）`)
  return res.json() as Promise<T>
}

export const stockResearchApi = {
  analysis: () => getJson<AnalysisData>('analysis.json'),
  performance: () => getJson<PerformanceData>('ai_performance.json'),
  archive: () => getJson<ArchiveData>('analysis_archive.json'),
  result: () => getJson<ResultData>('result.json'),
}
