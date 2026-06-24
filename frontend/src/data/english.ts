// Mock content library for the AI English Coach (Phase 1). Structured to match
// the future /api/english/* DTOs so swapping to the backend touches only the api
// layer, not the views.

import type {
  EnglishScenario,
  VocabularyItem,
  PhrasePattern,
  GrammarLesson,
  SpeakingPracticeItem,
  ScenarioCategory,
} from '@/types/english'

export const SCENARIO_LABELS: Record<ScenarioCategory, string> = {
  travel: '旅遊英文',
  restaurant: '餐廳點餐',
  hotel: '飯店入住',
  airport: '機場通關',
  business: '商務會議',
  interview: '面試英文',
  daily: '日常聊天',
  support: '客服溝通',
  custom: '自訂情境',
}

export const scenarios: EnglishScenario[] = [
  {
    id: 'sc-hotel-checkin',
    title: 'Hotel check-in',
    category: 'hotel',
    difficulty: 'BEGINNER',
    estMinutes: 5,
    goals: ['完成入住報到', '詢問早餐與 Wi-Fi', '禮貌地提出要求'],
    requiredVocab: ['reservation', 'available', 'confirm'],
    requiredPhrases: ['I have a reservation under...', 'Could you please...'],
    voiceSupported: true,
    status: 'NOT_STARTED',
    coachName: 'Emma · Front desk',
  },
  {
    id: 'sc-restaurant-order',
    title: 'Ordering at a restaurant',
    category: 'restaurant',
    difficulty: 'BEGINNER',
    estMinutes: 6,
    goals: ['看懂菜單並點餐', '詢問推薦', '處理特殊需求'],
    requiredVocab: ['recommend', 'allergic', 'medium-rare'],
    requiredPhrases: ['I would like to...', 'Could I get...'],
    voiceSupported: true,
    status: 'NOT_STARTED',
    coachName: 'Leo · Waiter',
  },
  {
    id: 'sc-job-interview',
    title: 'Job interview — self introduction',
    category: 'interview',
    difficulty: 'INTERMEDIATE',
    estMinutes: 10,
    goals: ['做專業的自我介紹', '描述經歷與強項', '回答常見問題'],
    requiredVocab: ['responsible', 'achievement', 'collaborate'],
    requiredPhrases: ['I am responsible for...', 'One of my strengths is...'],
    voiceSupported: true,
    status: 'NOT_STARTED',
    coachName: 'Sarah · Hiring manager',
  },
  {
    id: 'sc-airport-security',
    title: 'Airport check-in & security',
    category: 'airport',
    difficulty: 'INTERMEDIATE',
    estMinutes: 7,
    goals: ['辦理登機', '回答安檢問題', '詢問登機門'],
    requiredVocab: ['boarding pass', 'luggage', 'gate'],
    requiredPhrases: ['Where is...', 'Do I need to...'],
    voiceSupported: true,
    status: 'NOT_STARTED',
    coachName: 'Officer Kim',
  },
]

export const vocabulary: VocabularyItem[] = [
  {
    id: 'v-reservation', word: 'reservation', pronunciation: '/ˌrezərˈveɪʃn/', partOfSpeech: 'n.',
    meaningZh: '預訂', example: 'I have a reservation under the name Chen.', usageNote: '飯店、餐廳訂位都用 reservation；動詞用 make a reservation。',
    scenario: 'hotel', difficulty: 'BEGINNER', tags: ['travel', 'hotel'], mastery: 'NEW', nextReviewDate: null,
    audioText: 'reservation. I have a reservation under the name Chen.',
  },
  {
    id: 'v-available', word: 'available', pronunciation: '/əˈveɪləbl/', partOfSpeech: 'adj.',
    meaningZh: '可用的、有空的', example: 'Is a room available for tonight?', usageNote: '問「有沒有」「有沒有空」很好用，比 have 自然。',
    scenario: 'hotel', difficulty: 'BEGINNER', tags: ['hotel', 'business'], mastery: 'NEW', nextReviewDate: null,
    audioText: 'available. Is a room available for tonight?',
  },
  {
    id: 'v-recommend', word: 'recommend', pronunciation: '/ˌrekəˈmend/', partOfSpeech: 'v.',
    meaningZh: '推薦', example: 'What would you recommend?', usageNote: '點餐、購物時請對方推薦的萬用句。',
    scenario: 'restaurant', difficulty: 'BEGINNER', tags: ['restaurant', 'daily'], mastery: 'NEW', nextReviewDate: null,
    audioText: 'recommend. What would you recommend?',
  },
  {
    id: 'v-allergic', word: 'allergic', pronunciation: '/əˈlɜːrdʒɪk/', partOfSpeech: 'adj.',
    meaningZh: '過敏的', example: "I'm allergic to peanuts.", usageNote: 'be allergic to + 過敏原；點餐告知很重要。',
    scenario: 'restaurant', difficulty: 'INTERMEDIATE', tags: ['restaurant', 'health'], mastery: 'NEW', nextReviewDate: null,
    audioText: "allergic. I'm allergic to peanuts.",
  },
  {
    id: 'v-responsible', word: 'responsible', pronunciation: '/rɪˈspɑːnsəbl/', partOfSpeech: 'adj.',
    meaningZh: '負責的', example: 'I am responsible for the marketing team.', usageNote: 'be responsible for + 職責；面試描述工作必備。',
    scenario: 'interview', difficulty: 'INTERMEDIATE', tags: ['business', 'interview'], mastery: 'NEW', nextReviewDate: null,
    audioText: 'responsible. I am responsible for the marketing team.',
  },
  {
    id: 'v-collaborate', word: 'collaborate', pronunciation: '/kəˈlæbəreɪt/', partOfSpeech: 'v.',
    meaningZh: '合作', example: 'I collaborate with designers and engineers.', usageNote: '比 work together 更專業，面試加分。',
    scenario: 'interview', difficulty: 'ADVANCED', tags: ['business', 'interview'], mastery: 'NEW', nextReviewDate: null,
    audioText: 'collaborate. I collaborate with designers and engineers.',
  },
  {
    id: 'v-boarding-pass', word: 'boarding pass', pronunciation: '/ˈbɔːrdɪŋ pæs/', partOfSpeech: 'n.',
    meaningZh: '登機證', example: 'May I see your boarding pass?', usageNote: '機場安檢、登機都會用到。',
    scenario: 'airport', difficulty: 'BEGINNER', tags: ['travel', 'airport'], mastery: 'NEW', nextReviewDate: null,
    audioText: 'boarding pass. May I see your boarding pass?',
  },
  {
    id: 'v-confirm', word: 'confirm', pronunciation: '/kənˈfɜːrm/', partOfSpeech: 'v.',
    meaningZh: '確認', example: 'Let me confirm your booking.', usageNote: '商務、客服、訂位確認都常見。',
    scenario: 'business', difficulty: 'BEGINNER', tags: ['business', 'hotel'], mastery: 'NEW', nextReviewDate: null,
    audioText: 'confirm. Let me confirm your booking.',
  },
]

export const phrases: PhrasePattern[] = [
  {
    id: 'p-wondering', pattern: 'I was wondering if...', meaningZh: '我在想是否…（很客氣地提出請求）',
    scenario: 'business', examples: ['I was wondering if you could help me.', 'I was wondering if the room is available.'],
    commonMistakes: ['I wondering if...（漏 was）', 'I was wondering that...（應用 if）'], practicePrompt: '用 I was wondering if 客氣地請對方幫忙。', difficulty: 'INTERMEDIATE',
  },
  {
    id: 'p-could-you', pattern: 'Could you please...', meaningZh: '可以請你…嗎（禮貌請求）',
    scenario: 'daily', examples: ['Could you please repeat that?', 'Could you please send me the file?'],
    commonMistakes: ['Could you please to help?（please 後直接接原形動詞）'], practicePrompt: '用 Could you please 請對方再說一次。', difficulty: 'BEGINNER',
  },
  {
    id: 'p-i-would-like', pattern: 'I would like to...', meaningZh: '我想要…（比 I want 禮貌）',
    scenario: 'restaurant', examples: ['I would like to order now.', "I'd like to check in, please."],
    commonMistakes: ['I would like order.（漏 to）'], practicePrompt: '用 I would like to 點餐或表達需求。', difficulty: 'BEGINNER',
  },
  {
    id: 'p-not-sure', pattern: "I'm not sure if...", meaningZh: '我不確定是否…',
    scenario: 'daily', examples: ["I'm not sure if this is correct.", "I'm not sure if I understand."],
    commonMistakes: ["I'm not sure that...（不確定用 if/whether）"], practicePrompt: '用 I am not sure if 表達不確定。', difficulty: 'INTERMEDIATE',
  },
  {
    id: 'p-looking-forward', pattern: "I'm looking forward to...", meaningZh: '我很期待…（to 後接名詞或 V-ing）',
    scenario: 'business', examples: ["I'm looking forward to the meeting.", "I'm looking forward to hearing from you."],
    commonMistakes: ["looking forward to meet（應為 to meeting）"], practicePrompt: '用 looking forward to 表達期待。', difficulty: 'INTERMEDIATE',
  },
  {
    id: 'p-used-to', pattern: 'I used to...', meaningZh: '我以前都…（現在不再）',
    scenario: 'daily', examples: ['I used to live in Taipei.', 'I used to play basketball.'],
    commonMistakes: ['I used to lived（used to 後接原形）'], practicePrompt: '用 I used to 描述以前的習慣。', difficulty: 'INTERMEDIATE',
  },
]

export const grammarLessons: GrammarLesson[] = [
  {
    id: 'g-past-tense', topic: 'Past tense — 過去式',
    summaryZh: '描述已經發生的事，動詞要用過去式（規則 +ed，不規則需記）。',
    correctExamples: ['I went to the store yesterday.', 'She finished her homework.'],
    wrongExamples: ['I go to the store yesterday.', 'She finish her homework.'],
    explanationZh: '有過去時間詞（yesterday, last week）時，動詞一定要過去式；go→went 是不規則。',
    questions: [
      { id: 'g-past-q1', kind: 'choice', prompt: 'I ___ to the gym yesterday.', options: ['go', 'went', 'going'], answer: 'went', explanationZh: 'yesterday 表過去，go 的過去式是 went。' },
      { id: 'g-past-q2', kind: 'cloze', prompt: 'She ___ (finish) her work an hour ago.', answer: 'finished', explanationZh: 'finish 是規則動詞，過去式加 ed。' },
    ],
  },
  {
    id: 'g-present-perfect', topic: 'Present perfect — 現在完成式',
    summaryZh: 'have/has + 過去分詞，談「到現在為止」的經驗或結果。',
    correctExamples: ['I have visited Japan.', 'She has just left.'],
    wrongExamples: ['I have visit Japan.', 'I visited Japan since 2020.'],
    explanationZh: '經驗、剛完成、持續到現在用完成式；since/for 常搭配完成式。',
    questions: [
      { id: 'g-pp-q1', kind: 'choice', prompt: 'I ___ never been to Europe.', options: ['have', 'has', 'had'], answer: 'have', explanationZh: '主詞 I 用 have；been 是 be 的過去分詞。' },
    ],
  },
  {
    id: 'g-articles', topic: 'Articles — 冠詞 a / an / the',
    summaryZh: 'a/an 指「一個（泛指）」，the 指「特定的那個」。',
    correctExamples: ['I bought a book.', 'Close the door, please.'],
    wrongExamples: ['I bought book.', 'Close door, please.'],
    explanationZh: '單數可數名詞前通常要冠詞；母音音開頭用 an（an apple）。',
    questions: [
      { id: 'g-art-q1', kind: 'choice', prompt: 'She is ___ honest person.', options: ['a', 'an', 'the'], answer: 'an', explanationZh: 'honest 的 h 不發音，音以母音開頭，用 an。' },
    ],
  },
]

export const speakingItems: SpeakingPracticeItem[] = [
  { id: 's-1', targetText: 'I have a reservation under the name Chen.', translationZh: '我有一筆用 Chen 這個名字訂的預訂。', difficulty: 'BEGINNER', voiceSupported: true },
  { id: 's-2', targetText: 'Could you please recommend something popular?', translationZh: '可以請你推薦一些受歡迎的嗎？', difficulty: 'BEGINNER', voiceSupported: true },
  { id: 's-3', targetText: 'I was wondering if you could help me with this.', translationZh: '我在想你是否可以幫我處理這個。', difficulty: 'INTERMEDIATE', voiceSupported: true },
  { id: 's-4', targetText: 'One of my strengths is solving problems under pressure.', translationZh: '我的強項之一是在壓力下解決問題。', difficulty: 'INTERMEDIATE', voiceSupported: true },
  { id: 's-5', targetText: "I'm looking forward to working with your team.", translationZh: '我很期待與你的團隊合作。', difficulty: 'INTERMEDIATE', voiceSupported: true },
]

// A lightweight scripted coach used when the AI key is absent — keeps the
// Conversation Room fully usable with zero cost.
export function mockCoachReply(scenario: EnglishScenario | undefined, userText: string): string {
  const t = userText.toLowerCase()
  if (/reservation|book|check.?in/.test(t)) return 'Great, I found your reservation. Would you like a room with a city view?'
  if (/recommend|popular|suggest/.test(t)) return "I'd recommend our grilled salmon — it's very popular. Would you like to try it?"
  if (/thank|thanks/.test(t)) return "You're welcome! Is there anything else I can help you with?"
  if (/\?$/.test(userText.trim())) return "That's a good question. Let me check that for you. Anything else?"
  return `Nice! ${scenario ? `Let's keep practicing "${scenario.title}".` : ''} Could you tell me a bit more?`
}
