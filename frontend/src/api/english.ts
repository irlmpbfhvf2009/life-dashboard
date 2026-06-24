// AI English Coach data access. Phase 1 serves content from the mock library and
// routes conversation/correction through the existing free-tier Gemini endpoints,
// falling back to a scripted coach when AI is not configured (zero-key usable).
//
// The method surface mirrors the future /api/english/* contract, so Phase 2 swaps
// the bodies for http calls without touching the views.

import { aiApi, type ChatTurn } from '@/api'
import {
  scenarios as mockScenarios,
  vocabulary as mockVocab,
  phrases as mockPhrases,
  grammarLessons as mockGrammar,
  speakingItems as mockSpeaking,
  mockCoachReply,
} from '@/data/english'
import type {
  EnglishCorrection,
  EnglishScenario,
  GrammarLesson,
  PhrasePattern,
  SpeakingPracticeItem,
  VocabularyItem,
} from '@/types/english'

const tick = <T>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

export interface CoachTurnResult {
  reply: string
  correction: string | null
}

export const englishApi = {
  // ---- Content (mock in Phase 1) ----
  getScenarios: (): Promise<EnglishScenario[]> => tick(mockScenarios.map((s) => ({ ...s }))),
  getScenario: (id: string): Promise<EnglishScenario | undefined> =>
    tick(mockScenarios.find((s) => s.id === id)),
  getVocabulary: (): Promise<VocabularyItem[]> => tick(mockVocab.map((v) => ({ ...v }))),
  getPhrases: (): Promise<PhrasePattern[]> => tick(mockPhrases.map((p) => ({ ...p }))),
  getGrammar: (): Promise<GrammarLesson[]> => tick(mockGrammar.map((g) => ({ ...g }))),
  getSpeakingItems: (): Promise<SpeakingPracticeItem[]> => tick(mockSpeaking.map((s) => ({ ...s }))),

  /**
   * One conversation turn. Uses Gemini when available; on any failure (incl. the
   * key being absent → 503) falls back to a scripted coach so practice never breaks.
   */
  async coachTurn(params: {
    scenario?: EnglishScenario
    message: string
    history: ChatTurn[]
  }): Promise<CoachTurnResult> {
    try {
      const r = await aiApi.englishChat({ message: params.message, history: params.history })
      return { reply: r.reply, correction: r.correction }
    } catch {
      return { reply: mockCoachReply(params.scenario, params.message), correction: null }
    }
  },

  /**
   * Structured sentence correction. Uses the backend /api/ai/english/correct
   * when AI is configured; otherwise returns a graceful local stand-in.
   */
  async correctSentence(text: string): Promise<EnglishCorrection> {
    try {
      return await aiApi.englishCorrect({ message: text })
    } catch {
      return localCorrection(text)
    }
  },
}

/** Minimal offline correction so the Sentence Coach is usable with no key. */
function localCorrection(text: string): EnglishCorrection {
  const trimmed = text.trim()
  return {
    original: trimmed,
    corrected: trimmed,
    natural: trimmed,
    explanationZh: 'AI 修正尚未啟用（後端缺少 GEMINI_API_KEY），目前顯示原句。設定金鑰後即可獲得文法與自然度建議。',
    grammarIssues: [],
    alternatives: [],
    examples: [],
  }
}
