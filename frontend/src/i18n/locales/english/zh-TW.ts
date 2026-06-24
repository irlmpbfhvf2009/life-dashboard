// UI-chrome strings for the AI English Coach module (namespace `ec`). Learning
// *content* (word meanings, examples, grammar explanations, scenario goals) lives
// in data/english.ts and stays zh-TW — that's pedagogical content, not UI i18n.

export default {
  nav: {
    home: '首頁', foundation: '基礎學習', practice: 'AI 練習', speaking: '口說', growth: '複習成長',
    path: '學習路徑', vocab: '單字', phrases: '句型', grammar: '文法', missions: '每日任務',
    scenarios: '情境練習', coach: '句子修正', speakingPractice: '口說練習',
    mistakes: '常錯庫', review: '複習', progress: '學習進度',
  },
  act: {
    all: '全部', read: '朗讀', readSlow: '慢速朗讀', reveal: '顯示解答', collapse: '收合',
    iKnow: '我會了', mastered: '已掌握', addReview: '加入複習', added: '已加入複習', queued: '複習佇列中',
    retry: '再試一次', submit: '送出', prev: '上一個', next: '下一個', prevCard: '上一張', nextCard: '下一張',
    prevSentence: '上一句', nextSentence: '下一句', backHome: '回教練首頁', viewAll: '查看全部',
    start: '開始', restart: '重新開始',
  },
  mastery: { NEW: '新', LEARNING: '學習中', REVIEWING: '複習中', MASTERED: '已掌握' },
  difficulty: { BEGINNER: '初級', INTERMEDIATE: '中級', ADVANCED: '進階' },
  level: { BEGINNER: '初級', INTERMEDIATE: '中級', ADVANCED: '進階' },
  scat: {
    travel: '旅遊英文', restaurant: '餐廳點餐', hotel: '飯店入住', airport: '機場通關', business: '商務會議',
    interview: '面試英文', daily: '日常聊天', support: '客服溝通', custom: '自訂情境',
  },
  mcat: { grammar: '文法', vocab: '單字', tense: '時態', preposition: '介系詞', unnatural: '不自然', chinglish: '中式英文', speech: '口說' },
  voice: { unsupported: '此瀏覽器不支援語音辨識，已自動切換為文字輸入模式。建議使用桌面版 Chrome 或 Edge 體驗完整口說功能。', stop: '停止', hold: '按住說話', micUnsupported: '此瀏覽器不支援語音輸入' },

  home: {
    title: 'AI 英文教練', subtitle: '用英文自然對話、跟讀練口說、被即時修正，每天一點一滴累積。',
    placement: '程度檢測', quickStart: '快速開始',
    todayProgress: '今日進度', tasksN: '{done} / {total} 任務',
    streak: '連續學習', streakDays: '{n} 天', keepStreak: '保持 streak',
    weekPractice: '本週練習', minutesN: '{n} 分', studyTime: '學習時間',
    currentLevel: '目前程度', assessed: '已檢測', notAssessed: '尚未檢測',
    entrySpeakingDesc: '跟讀 + 即時相似度回饋', entryCoachDesc: '貼上英文，AI 幫你改更自然', entryReviewDesc: '{n} 項待複習',
    recommendedScenarios: '推薦情境練習', mistakeFocus: '常錯重點', mistakeLibrary: '常錯庫',
    noMistakes: '還沒有常錯紀錄——開始一段對話或句子修正，錯誤會自動收集到這裡。',
  },

  conversation: {
    scenarioList: '情境列表', goals: '學習目標', requiredVocab: '必用單字', usablePhrases: '可用句型', voiceMode: '語音模式',
    progress: '對話進度', notFound: '找不到這個情境。', loading: '載入情境…',
    placeholder: '用英文回覆…', finished: '練習已結束',
    hint: '給我提示', rephrase: '換個說法', natural: '更自然', easier: '降低難度', readOnce: '唸一次', finish: '結束並總結',
    done: '已完成本情境，計入學習進度。',
  },
  feedback: {
    title: '即時回饋', empty: '送出一句英文後，這裡會顯示文法、自然度與句型分析。',
    patternScore: '句型分數', patternScoreSub: '綜合文法與自然度',
    grammar: '文法提醒', natural: '更自然的說法', vocab: '單字建議',
    addReview: '把這個錯誤加入複習', added: '已加入複習',
  },

  speaking: {
    title: '口說練習', subtitle: '聽 AI 朗讀，按麥克風跟讀，系統即時比對你的發音內容並給回饋。',
    loading: '載入句子…', today: '今日口說', accMinutes: '累積練習時間', attempts: '語音嘗試', totalShadow: '總跟讀次數',
    progress: '練習進度', thisSet: '本組句子', attemptsN: '嘗試 {n} 次', startShadow: '按麥克風開始跟讀', manualHint: '改用文字輸入你說的句子',
    target: '目標句', youSaid: '你說的（語音辨識）', missed: '可能漏掉或說錯：', similarity: '相似度', fluency: '流暢度', completeness: '完整度',
  },

  coach: {
    title: '句子修正', subtitle: '貼上一句英文，AI 幫你修正文法、給更自然的說法，並可朗讀與加入複習。',
    yourSentence: '你的句子', result: '修正結果', placeholder: '例如：I very like this movie.',
    aiFix: 'AI 修正', fixing: '修正中…', noResult: '尚無修正', noResultDesc: '輸入一句英文並按「AI 修正」。', analyzing: '分析中…',
    addReview: '加入常錯複習', original: '原句', corrected: '修正版', moreNatural: '更自然的說法', grammarIssues: '文法問題', alternatives: '其他說法', examples: '例句',
  },

  scenario: {
    title: '情境練習', subtitle: '挑一個真實情境，和 AI 角色用英文完成任務並獲得即時回饋。', loading: '載入情境…',
    minutesN: '{n} 分鐘', voiceSupported: '支援語音', start: '開始練習', again: '再練一次',
    emptyTitle: '此分類暫無情境', emptyDesc: '換個分類看看。',
  },

  vocab: {
    title: '單字系統', subtitle: '情境單字卡：先看英文與發音，揭曉解答、聽例句，會了就標記掌握或加入複習。',
    loading: '載入單字…', mastered: '已掌握單字', totalWords: '共 {n} 字', currentCat: '目前分類', wordsN: '{n} 字',
    learnProgress: '學習進度', thisSet: '本組單字',
  },
  phrase: {
    title: '句型庫', subtitle: '學常用句型：聽 AI 唸、看例句與常見錯誤，再用句型造句讓 AI 即時檢查。',
    loading: '載入句型…', mastered: '已掌握句型', totalPatterns: '共 {n} 個', thisPage: '本頁句型', canCompose: '可造句練習',
    examples: '例句', commonMistakes: '常見錯誤', aiCheck: 'AI 檢查', checking: '檢查中…', composeHint: '用這個句型造句…',
    emptyTitle: '此難度暫無句型', emptyDesc: '換個難度看看。',
  },
  grammar: {
    title: '基礎文法', subtitle: '可行動的文法卡：正確 vs 中式英文對照、中文解析與互動練習；答錯自動收進常錯庫。',
    loading: '載入文法…', correct: '正確', wrong: '錯誤', practice: '小練習',
    qReference: '參考答案：', qRight: '答對了！', qWrong: '再想想', qSubmitted: '已提交，參考下方解析', composePlaceholder: '用這個句型造句…', clozePlaceholder: '填入答案',
  },

  mistakes: {
    title: '常錯庫', subtitle: '對話、句子修正與文法練習中的錯誤會自動收集到這裡，分類整理、加入複習。',
    total: '常錯總數', accCollected: '累積收集', masteredN: '已掌握', ofN: '共 {n} 項', queue: '複習佇列', queueSub: '待複習的常錯',
    emptyTitle: '目前沒有常錯紀錄', emptyDesc: '去對話室、句子修正或文法練習，犯的錯會自動收集到這裡。', recent: '最近 {date}',
  },
  review: {
    title: '複習', subtitle: '用間隔複習鞏固單字、句型與常錯句：記得就拉長間隔，忘記就明天再來。',
    dueToday: '今日待複習', dueItems: '到期項目', todayRate: '今日完成率', reviewedN: '已複習 {n} 項', mastered: '已掌握', accMastered: '累積掌握',
    doneTitle: '今日複習完成！', doneDesc: '所有到期項目都複習過了。去學新單字、句型或對話，明天再回來複習。',
    allItems: '全部複習項目', recall: '回想看看，再揭曉', remember: '記得', forgot: '忘記了', stillRemember: '還記得嗎？',
    refVocab: '單字', refPhrase: '句型', refMistake: '常錯句', refSpeaking: '口說',
  },
  progress: {
    title: '學習進度', subtitle: '你的練習量、掌握程度與常錯分布，一覽學習軌跡。',
    streak: '連續學習', studyTime: '學習時間', acc: '累積', speaking: '口說練習', attemptsN: '{n} 次嘗試',
    scenariosDone: '完成情境', convPractice: '對話練習', mastery: '掌握程度', masteredVocab: '掌握單字', masteredPhrases: '掌握句型', unit: '個',
    distribution: '常錯類型分布', distEmpty: '尚無常錯資料', distEmptyDesc: '練習後犯的錯會在這裡形成分布圖。', totalTimes: '總次數',
  },

  placement: {
    title: '程度檢測', subtitle: '花兩分鐘做幾題，AI 幫你推估程度、找出弱點並推薦學習路徑。',
    quizN: '{n} 題快速檢測', quizDesc: '涵蓋時態、冠詞、介系詞、單字、句型與語感。完成後給你程度與建議。', startTest: '開始檢測',
    answeredN: '已作答 {done} / {total}', viewResult: '查看結果', remainN: '還有 {n} 題', retake: '重新檢測',
    estimated: '推估程度', weaknesses: '常見弱點', noWeakness: '表現很均衡，沒有明顯弱點！',
    speakingFocus: '口說建議方向', suggestedUnits: '建議先學的單元', viewPath: '查看學習路徑',
  },
  path: {
    title: '學習路徑', subtitle: '依你的程度與掌握進度，安排單字、句型、文法與情境的學習順序。',
    loading: '整理你的學習路徑…', overall: '整體進度', currentLevel: '目前程度', assessed: '已檢測', notAssessed: '尚未檢測',
    masteredSkills: '已掌握技能', ofUnits: '共 {n} 單元', units: '學習單元', recommended: '推薦', itemsN: '{n} 項',
    unitVocab: '核心單字', unitPhrase: '常用句型', unitGrammar: '基礎文法', unitScenario: '情境對話',
    skillsHint: '完成上面的單元（在單字/句型頁標記「我會了」、在情境完成對話）就會解鎖技能。',
  },
  mission: { title: '今日任務', sub: '完成今天的學習節奏', doneN: '{done} / {total} 完成' },
  comingSoon: { phase2: 'Phase 2 開發中', phase2Desc: '此頁的完整體驗會在下一階段完成（接 Spring Boot 後端與資料庫）。資料模型與設計已就緒。', back: '回教練首頁' },
}
