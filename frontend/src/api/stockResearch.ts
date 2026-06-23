import type { AnalysisData, PerformanceData, ArchiveData } from '@/types/stock'

// The AI stock-research data is produced by the separate (public) stock-radar
// project and committed to its repo daily. We read it straight from GitHub raw
// so the Studio always shows the latest analysis — no copying, no backend, free.
// raw.githubusercontent.com serves with `access-control-allow-origin: *`.
const BASE =
  import.meta.env.VITE_STOCK_DATA_BASE ||
  'https://raw.githubusercontent.com/irlmpbfhvf2009/stock-radar/main/public'

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
}
