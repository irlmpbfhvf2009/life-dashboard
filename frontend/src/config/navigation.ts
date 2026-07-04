import type { Component } from 'vue'
import {
  LayoutDashboard,
  Sparkles,
  HeartPulse,
  Wallet,
  FlaskConical,
  Library,
  FolderGit2,
  Gamepad2,
  ShieldCheck,
  NotebookPen,
  Repeat,
  Target,
  Scale,
  UtensilsCrossed,
  LineChart,
  Bot,
  GraduationCap,
  BookOpen,
  Bookmark,
  FileText,
  Plane,
  Languages,
  Calculator,
  Users,
} from 'lucide-vue-next'

export type AppStatus = 'ACTIVE' | 'BETA' | 'DRAFT'
export type AppCategory = 'LIFE' | 'HEALTH' | 'FINANCE' | 'AI' | 'KNOWLEDGE' | 'PORTFOLIO' | 'TRAVEL'

export interface NavGroup {
  key: string
  label: string
  icon: Component
  to: string
  /** Role required to see this entry. Omitted = always visible. */
  requires?: 'player' | 'admin'
}

export interface StudioApp {
  key: string
  name: string
  description: string
  category: AppCategory
  status: AppStatus
  icon: Component
  to: string
  lastUsed?: string // ISO date, optional
}

/** Top-level sidebar — only big categories, never individual tools. */
export const navGroups: NavGroup[] = [
  { key: 'overview', label: '總覽', icon: LayoutDashboard, to: '/' },
  // 生活管理 hub: 待辦 / 心情日記 / 財務分析 (tabs inside the view).
  { key: 'life', label: '生活管理', icon: Sparkles, to: '/life' },
  { key: 'health', label: '健康減脂', icon: HeartPulse, to: '/health' },
  { key: 'ai', label: 'AI 實驗室', icon: FlaskConical, to: '/ai' },
  { key: 'travel', label: '旅遊', icon: Plane, to: '/travel' },
  { key: 'social', label: '社交', icon: Users, to: '/social' },
  // 知識 hub: 筆記 + 書庫 (sub-nav inside the module).
  { key: 'knowledge', label: '知識', icon: Library, to: '/knowledge' },
  // 娛樂 hub: 命運 + 食物輪盤 (+ 遊戲 portal for players, in the sub-nav).
  { key: 'fun', label: '娛樂', icon: Gamepad2, to: '/fun' },
  { key: 'portfolio', label: '作品展示', icon: FolderGit2, to: '/portfolio' },
  // Role-gated — hidden unless the user has the matching role.
  { key: 'admin', label: '管理後台', icon: ShieldCheck, to: '/admin', requires: 'admin' },
]

export const categoryMeta: Record<AppCategory, { label: string; tint: string }> = {
  LIFE: { label: '生活管理', tint: 'text-violet-600 bg-violet-50' },
  HEALTH: { label: '健康減脂', tint: 'text-emerald-600 bg-emerald-50' },
  FINANCE: { label: '財務分析', tint: 'text-amber-600 bg-amber-50' },
  AI: { label: 'AI 實驗室', tint: 'text-brand-600 bg-brand-50' },
  KNOWLEDGE: { label: '知識庫', tint: 'text-sky-600 bg-sky-50' },
  PORTFOLIO: { label: '作品展示', tint: 'text-rose-600 bg-rose-50' },
  TRAVEL: { label: '旅遊', tint: 'text-teal-600 bg-teal-50' },
}

export const statusMeta: Record<AppStatus, { label: string; cls: string }> = {
  ACTIVE: { label: '已上線', cls: 'badge-green' },
  BETA: { label: 'Beta', cls: 'badge-amber' },
  DRAFT: { label: '開發中', cls: 'badge-gray' },
}

/** All studio apps, surfaced in the App Center. */
export const studioApps: StudioApp[] = [
  { key: 'life-log', name: '生活紀錄', description: '用時間軸記錄每天發生的事', category: 'LIFE', status: 'ACTIVE', icon: Sparkles, to: '/life', lastUsed: '2026-06-23' },
  { key: 'journal', name: '日記', description: '專注的寫作空間與心情標籤', category: 'LIFE', status: 'BETA', icon: NotebookPen, to: '/life', lastUsed: '2026-06-22' },
  { key: 'habits', name: '習慣追蹤', description: '每日打卡、連續天數與完成率', category: 'LIFE', status: 'ACTIVE', icon: Repeat, to: '/life' },
  { key: 'goals', name: '目標管理', description: '年度與月目標、進度追蹤', category: 'LIFE', status: 'DRAFT', icon: Target, to: '/life' },
  { key: 'weight', name: '減脂管理', description: '體重趨勢、目標與達成進度', category: 'HEALTH', status: 'ACTIVE', icon: Scale, to: '/health', lastUsed: '2026-06-24' },
  { key: 'food', name: '飲食 / 斷食', description: '飲食紀錄與斷食時間追蹤', category: 'HEALTH', status: 'BETA', icon: UtensilsCrossed, to: '/health' },
  { key: 'finance', name: '記帳', description: '收支分類、月度統計與趨勢', category: 'FINANCE', status: 'ACTIVE', icon: Wallet, to: '/finance', lastUsed: '2026-06-23' },
  { key: 'stock-ai', name: 'AI 股票研究模型', description: '研究與模擬分析（非投資建議）', category: 'AI', status: 'BETA', icon: LineChart, to: '/ai/stock', lastUsed: '2026-06-21' },
  { key: 'english-ai', name: 'AI 英文教練', description: '練習對話與即時糾錯', category: 'AI', status: 'BETA', icon: GraduationCap, to: '/ai/english' },
  { key: 'data-lab', name: '資料分析工具', description: '上傳 CSV、欄位統計與圖表、AI 洞察', category: 'AI', status: 'ACTIVE', icon: Bot, to: '/ai/data-lab' },
  { key: 'travel-phrasebook', name: '旅遊用語包', description: '泰/日/韓/越情境短句＋發音＋AI 翻譯', category: 'TRAVEL', status: 'ACTIVE', icon: Languages, to: '/travel/phrasebook' },
  { key: 'travel-expense', name: '旅遊記帳', description: '當地貨幣記帳、自動換算台幣與分類', category: 'TRAVEL', status: 'ACTIVE', icon: Wallet, to: '/travel/expense' },
  { key: 'travel-tools', name: '換算 / 小費', description: '當地貨幣⇄台幣、小費與分帳計算', category: 'TRAVEL', status: 'ACTIVE', icon: Calculator, to: '/travel/tools' },
  { key: 'notes', name: '筆記', description: '結構化筆記與知識庫', category: 'KNOWLEDGE', status: 'ACTIVE', icon: BookOpen, to: '/knowledge' },
  { key: 'resources', name: '資源庫', description: '收藏連結與常用工具', category: 'KNOWLEDGE', status: 'DRAFT', icon: Bookmark, to: '/knowledge' },
  { key: 'projects', name: '作品集', description: '專案作品與技術棧展示', category: 'PORTFOLIO', status: 'ACTIVE', icon: FolderGit2, to: '/portfolio' },
  { key: 'case-studies', name: '案例研究', description: '深入的專案案例與成果', category: 'PORTFOLIO', status: 'DRAFT', icon: FileText, to: '/portfolio' },
]
