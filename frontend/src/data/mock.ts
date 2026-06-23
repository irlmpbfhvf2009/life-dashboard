// Mock data for Phase 1. Shapes mirror the planned Spring Boot DTOs so the
// views can later swap to real API calls with minimal change.

export interface DailyStatus {
  date: string
  mood: number // 1-5
  focusNote: string
  completion: number // 0-100
}

export interface WeightProgress {
  current: number
  target: number
  start: number
  trend: { date: string; weight: number }[]
}

export interface HabitSummary {
  todayDone: number
  todayTotal: number
  streak: number
  weekRate: number // 0-100
}

export interface FinanceSummary {
  monthSpend: number
  topCategory: string
  topCategoryAmount: number
  changeVsLastMonth: number // percent, negative = spent less
}

export interface JournalPreview {
  id: number
  title: string
  excerpt: string
  mood: number
  date: string
  tags: string[]
}

export const todayStatus: DailyStatus = {
  date: new Date().toISOString().slice(0, 10),
  mood: 4,
  focusNote: '完成 Studio 第一階段，並維持斷食 16 小時。',
  completion: 72,
}

export const weightProgress: WeightProgress = {
  current: 72.4,
  target: 68,
  start: 78,
  trend: [
    { date: '06-18', weight: 73.6 },
    { date: '06-19', weight: 73.2 },
    { date: '06-20', weight: 73.0 },
    { date: '06-21', weight: 72.8 },
    { date: '06-22', weight: 72.7 },
    { date: '06-23', weight: 72.5 },
    { date: '06-24', weight: 72.4 },
  ],
}

export const habitSummary: HabitSummary = {
  todayDone: 4,
  todayTotal: 6,
  streak: 12,
  weekRate: 81,
}

export const financeSummary: FinanceSummary = {
  monthSpend: 18420,
  topCategory: '餐飲',
  topCategoryAmount: 6240,
  changeVsLastMonth: -8,
}

export const recentJournals: JournalPreview[] = [
  {
    id: 1,
    title: '把生活儀表板升級成 Studio',
    excerpt: '今天重新定義了產品方向，從單純記帳工具變成個人智慧工作台，重點是模組化與質感。',
    mood: 5,
    date: '2026-06-24',
    tags: ['產品', '里程碑'],
  },
  {
    id: 2,
    title: '減脂進入第三週',
    excerpt: '體重穩定下降，斷食節奏抓到了，下週想加入阻力訓練。',
    mood: 4,
    date: '2026-06-22',
    tags: ['健康'],
  },
  {
    id: 3,
    title: 'AI 選股模型的邊界',
    excerpt: '把模型定位在「研究與模擬」，避免任何投資承諾，這樣比較踏實也比較負責。',
    mood: 4,
    date: '2026-06-21',
    tags: ['AI', '反思'],
  },
]

export const weekTrend = {
  labels: ['一', '二', '三', '四', '五', '六', '日'],
  weight: [73.2, 73.0, 72.8, 72.7, 72.6, 72.5, 72.4],
  mood: [3, 4, 4, 3, 5, 4, 4],
  habitRate: [60, 80, 100, 75, 90, 70, 83],
}

// AI stock research — research-only, no trading, no return promises.
export interface StockResearchItem {
  symbol: string
  name: string
  score: number // 0-100
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
  signal: string
}

export const stockWatchlist: StockResearchItem[] = [
  { symbol: '2330', name: '台積電', score: 82, risk: 'LOW', signal: '均線多頭排列' },
  { symbol: '2454', name: '聯發科', score: 74, risk: 'MEDIUM', signal: '量能轉強' },
  { symbol: '2317', name: '鴻海', score: 61, risk: 'MEDIUM', signal: '區間整理' },
  { symbol: '3008', name: '大立光', score: 48, risk: 'HIGH', signal: '波動偏高' },
]
