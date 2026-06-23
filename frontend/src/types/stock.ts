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
