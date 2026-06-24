// Phase-1 "pronunciation" scoring: pure text comparison between the target
// sentence and what speech-recognition heard. NOT phoneme-level — but the
// returned shape (PronunciationFeedback) is designed so the UI can later be
// backed by a real pronunciation-scoring service without changing.

import type { PronunciationFeedback } from '@/types/english'

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Token-level Levenshtein distance (insert/delete/substitute = 1). */
function tokenDistance(a: string[], b: string[]): number {
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

export interface SentenceComparison {
  similarityScore: number
  matchedWords: string[]
  missingWords: string[]
  extraWords: string[]
  feedbackMessage: string
}

/**
 * Compare the target sentence with what the learner actually said.
 * Returns a 0–100 similarity plus word-level diff for highlighting.
 */
export function compareSentence(targetText: string, spokenText: string): SentenceComparison {
  const target = normalize(targetText)
  const spoken = normalize(spokenText)

  if (!spoken.length) {
    return {
      similarityScore: 0,
      matchedWords: [],
      missingWords: target,
      extraWords: [],
      feedbackMessage: '沒有聽到內容，再試一次。',
    }
  }

  const dist = tokenDistance(target, spoken)
  const denom = Math.max(target.length, spoken.length) || 1
  const similarityScore = Math.max(0, Math.round((1 - dist / denom) * 100))

  const spokenSet = new Set(spoken)
  const targetSet = new Set(target)
  const matchedWords = target.filter((w) => spokenSet.has(w))
  const missingWords = target.filter((w) => !spokenSet.has(w))
  const extraWords = spoken.filter((w) => !targetSet.has(w))

  return {
    similarityScore,
    matchedWords,
    missingWords,
    extraWords,
    feedbackMessage: scoreMessage(similarityScore),
  }
}

function scoreMessage(score: number): string {
  if (score >= 90) return '非常棒！幾乎完全正確。'
  if (score >= 75) return '很好，再注意幾個字就更完美了。'
  if (score >= 50) return '不錯的嘗試，跟著慢速再唸一次。'
  return '再聽一次範例，放慢速度跟讀。'
}

/**
 * Build the full PronunciationFeedback object the UI renders. Fluency &
 * completeness are heuristic stand-ins (Phase 1) derived from the same diff.
 */
export function toPronunciationFeedback(cmp: SentenceComparison, targetText: string): PronunciationFeedback {
  const targetLen = normalize(targetText).length || 1
  const completeness = Math.round((cmp.matchedWords.length / targetLen) * 100)
  // Fewer extra words ⇒ smoother read.
  const fluency = Math.max(0, 100 - cmp.extraWords.length * 12)
  return {
    similarityScore: cmp.similarityScore,
    fluency,
    completeness,
    missingWords: cmp.missingWords,
    matchedWords: cmp.matchedWords,
    message: cmp.feedbackMessage,
  }
}
