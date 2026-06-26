// Shared API types mirroring the backend DTOs.

export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string | null
}

export interface UserProfile {
  id: number
  firebaseUid: string
  email: string
  displayName: string | null
  photoUrl: string | null
  isStudio: boolean
  isPlayer: boolean
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

export type TodoStatus = 'TODO' | 'DONE'
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Todo {
  id: number
  title: string
  description: string | null
  status: TodoStatus
  priority: TodoPriority
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface WeightRecord {
  id: number
  date: string
  weight: number
  note: string | null
  createdAt: string
}

export interface WeightStats {
  range: string
  count: number
  min: number | null
  max: number | null
  average: number | null
  change: number | null
  points: WeightRecord[]
}

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'

export interface FoodRecord {
  id: number
  date: string
  mealType: MealType
  foodText: string
  note: string | null
  createdAt: string
}

export type ExpenseType = 'EXPENSE' | 'INCOME'

export interface Expense {
  id: number
  date: string
  amount: number
  category: string
  type: ExpenseType
  description: string | null
  createdAt: string
}

export interface MonthlyStats {
  month: string
  total: number
  byCategory: { category: string; total: number }[]
}

export interface MoodRecord {
  id: number
  date: string
  moodScore: number
  note: string | null
  createdAt: string
}

export interface MoodStats {
  count: number
  average: number | null
  distribution: Record<string, number>
  points: MoodRecord[]
}

export interface Note {
  id: number
  title: string
  content: string | null
  createdAt: string
  updatedAt: string
}

export interface UsageData {
  month: string
  requests: number
  freeRequestLimit: number
  budgetNote: string
}

export interface DashboardData {
  todayTodoCount: number
  todayDoneCount: number
  weekWeightTrend: WeightRecord[]
  monthExpenseTotal: number
  recentFoods: FoodRecord[]
  recentMoods: MoodRecord[]
  recentNotes: Note[]
}

// ---- Social ----
export type SocialRelation = 'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIEND'

export interface SocialUser {
  userId: number
  displayName: string | null
  photoUrl: string | null
  email: string
  relation: SocialRelation
  since: string | null
}

export interface FriendRequest {
  requestId: number
  user: SocialUser
  createdAt: string
}

export interface SocialPrivacy {
  shareHealth: boolean
  shareMood: boolean
  shareLife: boolean
}

export interface FriendProfile {
  userId: number
  displayName: string | null
  photoUrl: string | null
  email: string
  joinedAt: string
  visibility: { health: boolean; mood: boolean; life: boolean }
  health: {
    weightTrend: WeightRecord[]
    latestWeight: WeightRecord | null
    recentFoods: FoodRecord[]
  } | null
  mood: { recent: MoodRecord[]; average: number | null } | null
  life: { openTodos: number; todayTodos: number; todayDone: number } | null
}

// ---- Chat ----
export type ConversationType = 'DM' | 'GROUP' | 'PUBLIC'

export interface ChatLastMessage {
  content: string
  senderName: string
  createdAt: string
}

export interface Conversation {
  id: number
  type: ConversationType
  name: string | null
  photoUrl: string | null
  otherUserId: number | null
  memberCount: number
  lastMessage: ChatLastMessage | null
  unreadCount: number
  lastMessageAt: string
}

export type MessageKind = 'TEXT' | 'IMAGE' | 'GIF' | 'AUDIO'

export interface ChatMessage {
  id: number
  conversationId: number
  senderId: number
  senderName: string
  senderPhotoUrl: string | null
  kind: MessageKind
  content: string
  attachmentUrl: string | null
  createdAt: string
}

/** Read receipt: the timestamp at least one other member has read past. */
export interface ChatReadState {
  readAt: string | null
}

/** A member who has seen a specific message (for the group "seen by" list). */
export interface ChatReader {
  userId: number
  name: string
  photoUrl: string | null
  readAt: string
}

// ---- GIF (Tenor proxy) ----
export interface Gif {
  id: string
  url: string
  preview: string
  width: number
  height: number
  description: string
}
export interface GifPage {
  results: Gif[]
  next: string
}
