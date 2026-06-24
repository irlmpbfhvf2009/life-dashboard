// Types for the AI English Coach module. These mirror the future Spring Boot
// DTOs (/api/english/*); Phase 1 fulfils them with mock data + localStorage.

export type EnglishLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export type MasteryStatus = 'NEW' | 'LEARNING' | 'REVIEWING' | 'MASTERED'
export type ScenarioStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'

export type ScenarioCategory =
  | 'travel' | 'restaurant' | 'hotel' | 'airport' | 'business'
  | 'interview' | 'daily' | 'support' | 'custom'

export type MistakeCategory =
  | 'grammar' | 'vocab' | 'tense' | 'preposition' | 'unnatural' | 'chinglish' | 'speech'

export interface UserEnglishLevel {
  level: EnglishLevel
  cefr?: string // e.g. "A2", "B1"
  assessedAt: string | null
}

// ---- Learning path ----
export interface LearningUnit {
  id: string
  title: string
  type: 'vocab' | 'phrase' | 'grammar' | 'scenario'
  status: MasteryStatus
  itemCount: number
}
export interface LearningPath {
  level: EnglishLevel
  units: LearningUnit[]
  completedUnitIds: string[]
  nextUnitId: string | null
  masteredSkills: string[]
}

// ---- Vocabulary ----
export interface VocabularyItem {
  id: string
  word: string
  pronunciation: string // e.g. /ˌrezərˈveɪʃn/
  partOfSpeech: string
  meaningZh: string
  example: string
  usageNote: string
  scenario: ScenarioCategory
  difficulty: Difficulty
  tags: string[]
  mastery: MasteryStatus
  nextReviewDate: string | null
  audioText: string // what the TTS reads (usually word, then example)
}

// ---- Phrase bank ----
export interface PhrasePattern {
  id: string
  pattern: string // "I was wondering if..."
  meaningZh: string
  scenario: ScenarioCategory
  examples: string[]
  commonMistakes: string[]
  practicePrompt: string
  difficulty: Difficulty
}

// ---- Grammar ----
export type QuestionKind = 'choice' | 'cloze' | 'compose'
export interface PracticeQuestion {
  id: string
  kind: QuestionKind
  prompt: string
  options?: string[]
  answer: string
  explanationZh: string
}
export interface GrammarLesson {
  id: string
  topic: string
  summaryZh: string
  correctExamples: string[]
  wrongExamples: string[]
  explanationZh: string
  questions: PracticeQuestion[]
}

// ---- Daily mission ----
export interface MissionTask {
  id: string
  kind: 'vocab' | 'phrase' | 'conversation' | 'correction' | 'speaking' | 'review'
  label: string
  target: number
  progress: number
  done: boolean
  deepLink: string // route to the matching practice
}
export interface DailyMission {
  date: string
  tasks: MissionTask[]
  completedCount: number
  totalCount: number
}

// ---- Scenarios & conversation ----
export interface EnglishScenario {
  id: string
  title: string
  category: ScenarioCategory
  difficulty: Difficulty
  estMinutes: number
  goals: string[]
  requiredVocab: string[]
  requiredPhrases: string[]
  voiceSupported: boolean
  status: ScenarioStatus
  coachName: string // AI persona, e.g. "Emma (front desk)"
}
export interface EnglishSession {
  id: string
  scenarioId: string
  startedAt: string
  status: ScenarioStatus
  messageCount: number
  summary?: string
}
export interface EnglishMessage {
  id: string
  sessionId: string
  role: 'user' | 'coach'
  content: string
  audioText?: string
  createdAt: string
}

// ---- Corrections & feedback ----
export interface EnglishCorrection {
  original: string
  corrected: string
  natural: string
  explanationZh: string
  grammarIssues: string[]
  alternatives: string[]
  examples: string[]
}
/** Right-rail live feedback for one conversation turn. */
export interface TurnFeedback {
  grammarIssues: string[]
  natural: string | null
  vocabSuggestions: string[]
  patternScore: number // 0-100
  focusNote: string | null
  correctable: EnglishCorrection | null // "add to review"
}

// ---- Mistakes ----
export interface EnglishMistake {
  id: string
  category: MistakeCategory
  original: string
  corrected: string
  note: string
  frequency: number
  lastSeen: string
  mastery: MasteryStatus
}

// ---- Review ----
export interface ReviewItem {
  id: string
  refType: 'vocab' | 'phrase' | 'mistake' | 'speaking'
  refId: string
  title: string
  status: MasteryStatus
  dueDate: string
  interval: number // days
  ease: number
}

// ---- Speaking ----
export interface SpeakingPracticeItem {
  id: string
  targetText: string
  translationZh: string
  difficulty: Difficulty
  voiceSupported: boolean
}
export interface SpeechAttempt {
  id: string
  itemId: string
  spokenText: string
  similarityScore: number
  missingWords: string[]
  extraWords: string[]
  attempts: number
  createdAt: string
}
export interface PronunciationFeedback {
  similarityScore: number // 0-100
  fluency: number // 0-100
  completeness: number // 0-100
  missingWords: string[]
  matchedWords: string[]
  message: string
}

// ---- Placement ----
export interface PlacementResult {
  estimatedLevel: EnglishLevel
  recommendedPathId: string
  weaknesses: string[]
  suggestedUnits: string[]
  speakingFocus: string[]
}

// ---- Progress / dashboard ----
export interface EnglishProgressStats {
  weekSessions: number
  monthScenarios: number
  mistakeDistribution: Partial<Record<MistakeCategory, number>>
  streakDays: number
  studyMinutes: number
  masteredPhrases: number
  masteredVocab: number
  speakingMinutes: number
  speechAttempts: number
}

export interface EnglishDashboard {
  level: UserEnglishLevel
  mission: DailyMission
  stats: EnglishProgressStats
  reviewDueCount: number
  recentScenarios: EnglishScenario[]
  topMistakes: EnglishMistake[]
}
