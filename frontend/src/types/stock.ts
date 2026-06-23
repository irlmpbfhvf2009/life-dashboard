// Types mirroring the stock-radar project's public JSON
// (https://github.com/irlmpbfhvf2009/stock-radar/tree/main/public).

export interface MacroItem {
  name: string
  value: number
  change_pct: number
}

export interface ScoreDimension {
  score: number // 0-5
  verdict: string
  note: string
}

export type ScoreKey =
  | 'fundamental' | 'valuation' | 'chips' | 'technical'
  | 'industry' | 'catalyst' | 'expectation' | 'risk'

export interface TradePlan {
  buy_zone: string
  take_profit: string
  stop_loss: string
  exit_signals: string[]
}

export interface AnalysisStock {
  code: string
  name: string
  analyzed_at: string
  total_score: number // out of 40
  scores: Partial<Record<ScoreKey, ScoreDimension>>
  bull_case?: string[]
  bear_case?: string[]
  key_metrics?: string[]
  turn_bearish_if?: string[]
  trade_plan?: TradePlan
  detail?: Record<string, string>
}

export interface AnalysisData {
  updated_at: string
  ai_enabled: boolean
  model: string
  macro: MacroItem[]
  overview: {
    international_summary: string
    market_sentiment: string
    short_term: string
    mid_term: string
    long_term: string
  }
  stocks: AnalysisStock[]
}

export interface PerfWindow {
  window_days: number
  matured: number
  hits: number
  misses: number
  hit_rate_pct: number
  avg_days_to_target: number | null
  in_progress: number
  avg_win_pct: number | null
  avg_loss_pct: number | null
  avg_max_return_pct: number | null
  expectancy_pct: number | null
}

export interface TrackWindow {
  max_return_pct: number | null
  end_return_pct: number | null
  hit: boolean
  days_to_hit: number | null
  status: string // "open" | "hit" | ...
}

export interface TrackDetail {
  date: string
  code: string
  name: string
  total_score: number
  scores: Record<string, string> // dimension -> verdict
  entry_price: number
  windows: Record<string, TrackWindow>
  last_return_pct: number | null
  status_overall: string
}

export interface PerformanceData {
  updated_at: string
  windows: number[]
  target_pct: number
  ai_pick_min: number
  note: string
  benchmark_name: string
  summary: Record<string, PerfWindow>
  detail?: TrackDetail[]
}

export interface ArchiveData {
  updated_at: string
  stocks: Record<string, AnalysisStock>
}

// ---- Radar board (result.json) — the daily quantitative selection ----
export type Ohlc = [string, number, number, number, number] // date, o, h, l, c

export interface ChipInfo {
  date?: string
  big1000_pct?: number | null
  big400_pct?: number | null
  retail_pct?: number | null
  big1000_chg_1w?: number | null
  trend?: string
}

export interface IndustryInfo {
  name?: string
  avg_change_pct?: number
  market_avg_pct?: number
  rank?: number
  total?: number
  peers?: number
  strength?: string
}

export interface RadarStock {
  code: string
  name: string
  price: number
  change_pct: number
  volume_ratio: number
  rsi: number
  ma5: number
  ma20: number
  ma60: number
  ma240: number
  foreign_lots: number
  trust_lots: number
  ret_20d: number
  ret_60d: number
  rs_20d: number
  rs_60d: number
  qualified: boolean
  matched: string[]
  ohlc: Ohlc[]
  score?: number
  composite_score?: number
  sentiment?: {
    margin_balance?: number
    margin_change_pct?: number
    short_margin_ratio?: number
    flags?: string[]
  }
  industry?: IndustryInfo
  chip?: ChipInfo
  fundamentals?: {
    eps?: number
    gross_margin?: number
    net_margin?: number
    debt_ratio?: number
    roe_approx?: number
    tags?: string[]
  }
  deep?: {
    valuation_5y?: { pe_now?: number; pb_now?: number; yield_now?: number; verdict?: string }
  }
}

export interface ResultData {
  updated_at: string
  total: number
  stocks: RadarStock[]
}
