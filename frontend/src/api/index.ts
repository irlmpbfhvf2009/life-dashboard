import http, { request } from './http'
import type {
  DashboardData,
  Expense,
  FoodRecord,
  MealType,
  MonthlyStats,
  MoodRecord,
  MoodStats,
  Note,
  Todo,
  TodoPriority,
  TodoStatus,
  UsageData,
  UserProfile,
  WeightRecord,
  WeightStats,
} from '@/types'

// ---- User ----
export const userApi = {
  me: () => request<UserProfile>(() => http.get('/api/me')),
  update: (body: { displayName?: string; photoUrl?: string }) =>
    request<UserProfile>(() => http.patch('/api/me', body)),
  // Grant the signup portal's default role to brand-new users.
  source: (s: 'game' | 'studio') => request<UserProfile>(() => http.post(`/api/me/source/${s}`)),
}

// ---- Dashboard ----
export const dashboardApi = {
  get: () => request<DashboardData>(() => http.get('/api/dashboard')),
}

// ---- Wallet (server-authoritative game coins, read-only) ----
export interface WalletDto { coins: number; lastBonusDate: string | null; claimedToday: boolean }
export const walletApi = {
  get: () => request<WalletDto>(() => http.get('/api/wallet')),
}

// ---- Game (slot machine — spins resolved server-side) ----
export interface SpinResult { reels: number[]; bet: number; payout: number; balance: number }
export const gameApi = {
  spin: (bet: number) => request<SpinResult>(() => http.post('/api/game/slot/spin', { bet })),
}

// ---- Admin (root-admin only) ----
export interface AdminUser {
  id: number; email: string; displayName: string | null; photoUrl: string | null
  coins: number; isStudio: boolean; isPlayer: boolean; isAdmin: boolean; createdAt: string
}
export interface AdminWeight { id: number; date: string; weight: number; note: string | null; createdAt: string }
export const adminApi = {
  users: () => request<AdminUser[]>(() => http.get('/api/admin/users')),
  setRoles: (id: number, body: { isStudio: boolean; isPlayer: boolean; isAdmin: boolean }) =>
    request<AdminUser>(() => http.patch(`/api/admin/users/${id}/roles`, body)),
  adjustCoins: (id: number, delta: number) =>
    request<AdminUser>(() => http.post(`/api/admin/users/${id}/coins`, { delta })),
  weights: (id: number) => request<AdminWeight[]>(() => http.get(`/api/admin/users/${id}/weights`)),
}

// ---- AI (in-app Gemini-backed assistants) ----
export interface ChatTurn { role: 'user' | 'model'; content: string }
export interface ChatReply { reply: string; correction: string | null }
export interface SentenceCorrection {
  original: string
  corrected: string
  natural: string
  explanationZh: string
  grammarIssues: string[]
  alternatives: string[]
  examples: string[]
}
export interface DataInsight { summary: string; findings: string[]; suggestions: string[] }
export interface PhraseTranslation {
  nativeText: string
  pronunciation: string
  literal: string
  polite: string
  tip: string
}
export const aiApi = {
  status: () => request<{ enabled: boolean }>(() => http.get('/api/ai/status')),
  englishChat: (body: { message: string; history: ChatTurn[] }) =>
    request<ChatReply>(() => http.post('/api/ai/english/chat', body)),
  englishCorrect: (body: { message: string }) =>
    request<SentenceCorrection>(() => http.post('/api/ai/english/correct', body)),
  /** Translate Chinese → a travel language (lang = "Thai" | "Japanese" | "Korean" | "Vietnamese"). */
  phraseTranslate: (body: { message: string; lang: string }) =>
    request<PhraseTranslation>(() => http.post('/api/ai/phrase/translate', body)),
  /** Read a receipt photo (base64, no data: prefix) into expense fields. */
  receiptScan: (body: { image: string; mimeType: string; currency: string; categories: string[] }) =>
    request<ReceiptScan>(() => http.post('/api/ai/receipt', body)),
  /** Suggest sightseeing spots for a destination over N days. */
  suggestSpots: (body: { place: string; days: number }) =>
    request<{ spots: SpotSuggestion[] }>(() => http.post('/api/ai/spots', body)),
  dataLabAnalyze: (body: { profile: string }) =>
    request<DataInsight>(() => http.post('/api/ai/datalab/analyze', body)),
}
export interface ReceiptScan {
  amount: number
  currency: string
  category: string
  note: string
  date: string
}
export interface SpotSuggestion {
  name: string
  area: string
  reason: string
  day: number
}

// ---- Text-to-speech (server proxy → speaks any language without an OS voice) ----
export const ttsApi = {
  /** Fetch spoken audio as an object URL; the caller revokes it when finished. */
  async objectUrl(text: string, lang = 'th'): Promise<string> {
    const res = await http.get('/api/tts', { params: { text, lang }, responseType: 'blob' })
    return URL.createObjectURL(res.data as Blob)
  },
}

// ---- English Coach state (per-user, cross-device sync) ----
export const englishStateApi = {
  get: <T = unknown>() => request<T | null>(() => http.get('/api/english/state')),
  put: (state: unknown) => request<void>(() => http.put('/api/english/state', state)),
}

// ---- Travel state (per-user trip wallet, cross-device sync) ----
export const travelStateApi = {
  get: <T = unknown>() => request<T | null>(() => http.get('/api/travel/state')),
  put: (state: unknown) => request<void>(() => http.put('/api/travel/state', state)),
}

// ---- Trip sharing (read-only public links) ----
export interface ShareSummary {
  token: string
  createdAt: string
  destination: string
  departDate: string
  stops: number
}
export const travelShareApi = {
  /** Publish a snapshot; returns the public token. */
  create: (snapshot: unknown) =>
    request<{ token: string }>(() => http.post('/api/travel/share', snapshot)),
  /** The current user's published links. */
  list: () => request<ShareSummary[]>(() => http.get('/api/travel/shares')),
  revoke: (token: string) => request<void>(() => http.delete(`/api/travel/share/${token}`)),
}

// ---- Public trip view (no auth — used by the shared read-only page) ----
export const publicTripApi = {
  get: <T = unknown>(token: string) => request<T | null>(() => http.get(`/api/public/trip/${token}`)),
}

// ---- Foreign exchange (live rate proxy for the travel wallet) ----
export interface FxRate { from: string; to: string; rate: number; asOf: string }
export const fxApi = {
  rate: (from: string, to = 'TWD') =>
    request<FxRate>(() => http.get('/api/fx/rate', { params: { from, to } })),
}

// ---- Geocoding (Nominatim proxy for the itinerary map) ----
export interface GeoResult { lat: number; lon: number; displayName: string }
export const geoApi = {
  search: (q: string) => request<GeoResult | null>(() => http.get('/api/geo', { params: { q } })),
}

// ---- Library (free public-domain e-books, read in-site) ----
export interface BookSummary {
  id: number
  title: string
  author: string
  languages: string[]
  downloads: number
  hasText: boolean
}
export interface BookSearch { count: number; results: BookSummary[] }
export interface BookText { id: number; title: string; format: 'text' | 'html'; content: string }
export interface ZhResult { title: string; pageid: number; snippet: string }
export interface ZhPage { title: string; html: string }
export const bookApi = {
  /** Gutenberg search (blank q = popular). */
  search: (q: string, page = 1) =>
    request<BookSearch>(() => http.get('/api/books/search', { params: { q, page } })),
  /** Gutenberg full text. */
  text: (id: number) => request<BookText>(() => http.get('/api/books/text', { params: { id } })),
  /** Chinese Wikisource search. */
  zhSearch: (q: string) => request<ZhResult[]>(() => http.get('/api/books/zh/search', { params: { q } })),
  /** Chinese Wikisource page (rendered HTML — sanitize before display). */
  zhPage: (title: string) => request<ZhPage>(() => http.get('/api/books/zh/page', { params: { title } })),
}

// ---- Usage (owner-only free-tier bar) ----
export const usageApi = {
  get: () => request<UsageData>(() => http.get('/api/usage')),
}

// ---- Todos ----
export const todoApi = {
  list: (status?: TodoStatus) =>
    request<Todo[]>(() => http.get('/api/todos', { params: { status } })),
  create: (body: {
    title: string
    description?: string
    priority?: TodoPriority
    dueDate?: string | null
  }) => request<Todo>(() => http.post('/api/todos', body)),
  update: (
    id: number,
    body: Partial<{
      title: string
      description: string
      status: TodoStatus
      priority: TodoPriority
      dueDate: string | null
    }>,
  ) => request<Todo>(() => http.patch(`/api/todos/${id}`, body)),
  remove: (id: number) => request<void>(() => http.delete(`/api/todos/${id}`)),
}

// ---- Weights ----
export const weightApi = {
  list: () => request<WeightRecord[]>(() => http.get('/api/weights')),
  latest: () => request<WeightRecord | null>(() => http.get('/api/weights/latest')),
  stats: (range: '7d' | '30d' | '90d') =>
    request<WeightStats>(() => http.get('/api/weights/stats', { params: { range } })),
  create: (body: { date: string; weight: number; note?: string }) =>
    request<WeightRecord>(() => http.post('/api/weights', body)),
  remove: (id: number) => request<void>(() => http.delete(`/api/weights/${id}`)),
}

// ---- Foods ----
export const foodApi = {
  list: () => request<FoodRecord[]>(() => http.get('/api/foods')),
  create: (body: { date: string; mealType: MealType; foodText: string; note?: string }) =>
    request<FoodRecord>(() => http.post('/api/foods', body)),
  remove: (id: number) => request<void>(() => http.delete(`/api/foods/${id}`)),
}

// ---- Expenses ----
export const expenseApi = {
  list: () => request<Expense[]>(() => http.get('/api/expenses')),
  monthly: (month?: string) =>
    request<MonthlyStats>(() => http.get('/api/expenses/stats/monthly', { params: { month } })),
  create: (body: { date: string; amount: number; category: string; type?: 'EXPENSE' | 'INCOME'; description?: string }) =>
    request<Expense>(() => http.post('/api/expenses', body)),
  remove: (id: number) => request<void>(() => http.delete(`/api/expenses/${id}`)),
}

// ---- Moods ----
export const moodApi = {
  list: () => request<MoodRecord[]>(() => http.get('/api/moods')),
  stats: (days = 30) =>
    request<MoodStats>(() => http.get('/api/moods/stats', { params: { days } })),
  create: (body: { date: string; moodScore: number; note?: string }) =>
    request<MoodRecord>(() => http.post('/api/moods', body)),
  remove: (id: number) => request<void>(() => http.delete(`/api/moods/${id}`)),
}

// ---- Notes ----
export const noteApi = {
  list: () => request<Note[]>(() => http.get('/api/notes')),
  create: (body: { title: string; content?: string }) =>
    request<Note>(() => http.post('/api/notes', body)),
  update: (id: number, body: Partial<{ title: string; content: string }>) =>
    request<Note>(() => http.patch(`/api/notes/${id}`, body)),
  remove: (id: number) => request<void>(() => http.delete(`/api/notes/${id}`)),
}
