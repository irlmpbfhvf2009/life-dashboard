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

export interface Expense {
  id: number
  date: string
  amount: number
  category: string
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
