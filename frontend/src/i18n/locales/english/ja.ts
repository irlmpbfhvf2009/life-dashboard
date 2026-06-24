export default {
  nav: {
    home: 'ホーム', foundation: '基礎学習', practice: 'AI 練習', speaking: 'スピーキング', growth: '復習・成長',
    path: '学習パス', vocab: '単語', phrases: '構文', grammar: '文法', missions: 'デイリー',
    scenarios: 'シーン練習', coach: '文章添削', speakingPractice: 'スピーキング',
    mistakes: 'ミス集', review: '復習', progress: '学習状況',
  },
  act: {
    all: 'すべて', read: '再生', readSlow: 'ゆっくり', reveal: '答えを表示', collapse: '閉じる',
    iKnow: '覚えた', mastered: 'マスター済み', addReview: '復習に追加', added: '追加済み', queued: '復習キュー',
    retry: 'もう一度', submit: '送信', prev: '前へ', next: '次へ', prevCard: '前へ', nextCard: '次へ',
    prevSentence: '前へ', nextSentence: '次へ', backHome: 'ホームへ', viewAll: 'すべて見る',
    start: '開始', restart: 'やり直す',
  },
  mastery: { NEW: '新規', LEARNING: '学習中', REVIEWING: '復習中', MASTERED: 'マスター' },
  difficulty: { BEGINNER: '初級', INTERMEDIATE: '中級', ADVANCED: '上級' },
  level: { BEGINNER: '初級', INTERMEDIATE: '中級', ADVANCED: '上級' },
  scat: {
    travel: '旅行英語', restaurant: 'レストラン', hotel: 'ホテル', airport: '空港', business: 'ビジネス',
    interview: '面接', daily: '日常会話', support: 'カスタマー対応', custom: 'カスタム',
  },
  mcat: { grammar: '文法', vocab: '単語', tense: '時制', preposition: '前置詞', unnatural: '不自然', chinglish: '直訳英語', speech: 'スピーキング' },
  voice: { unsupported: 'このブラウザは音声認識に対応していません。テキスト入力に切り替えました。完全な機能はデスクトップ版 Chrome / Edge をご利用ください。' },

  home: {
    title: 'AI 英会話コーチ', subtitle: '英語で会話し、シャドーイングで発話練習、その場で添削 — 毎日少しずつ。',
    placement: 'レベル診断', quickStart: 'すぐ始める',
    todayProgress: '今日の進捗', tasksN: '{done} / {total} タスク',
    streak: '連続学習', streakDays: '{n} 日', keepStreak: 'ストリーク継続',
    weekPractice: '今週の練習', minutesN: '{n} 分', studyTime: '学習時間',
    currentLevel: '現在のレベル', assessed: '診断済み', notAssessed: '未診断',
    entrySpeakingDesc: 'シャドーイング＋類似度フィードバック', entryCoachDesc: '英文を貼ると AI が自然に', entryReviewDesc: '復習 {n} 件',
    recommendedScenarios: 'おすすめのシーン', mistakeFocus: 'ミスの要点', mistakeLibrary: 'ミス集',
    noMistakes: 'まだミスがありません。会話や文章添削を始めると自動でここに集まります。',
  },

  conversation: {
    scenarioList: 'シーン一覧', goals: '学習目標', requiredVocab: '必須単語', usablePhrases: '使える構文', voiceMode: '音声モード',
    progress: '会話の進捗', notFound: 'シーンが見つかりません。', loading: 'シーンを読み込み中…',
    placeholder: '英語で返信…', finished: '練習終了',
    hint: 'ヒント', rephrase: '言い換え', natural: 'より自然に', easier: 'やさしく', readOnce: '読み上げ', finish: '終了してまとめ',
    done: 'シーン完了 — 学習状況に反映されました。',
  },
  feedback: {
    title: 'リアルタイム添削', empty: '英文を送ると、文法・自然さ・構文の分析がここに表示されます。',
    patternScore: '構文スコア', patternScoreSub: '文法＋自然さ',
    grammar: '文法のヒント', natural: 'より自然な言い方', vocab: '単語の提案',
    addReview: 'このミスを復習に追加', added: '復習に追加済み',
  },

  speaking: {
    title: 'スピーキング練習', subtitle: 'AI を聞いてマイクでシャドーイング、話した内容を即時に照合してフィードバック。',
    loading: '文を読み込み中…', today: '今日', accMinutes: '累計練習時間', attempts: '音声試行', totalShadow: '総シャドーイング',
    progress: '進捗', thisSet: 'このセット', attemptsN: '{n} 回', startShadow: 'マイクでシャドーイング開始', manualHint: '話した内容をテキストで入力',
    target: 'お手本', youSaid: '認識結果', missed: '抜け・誤りの可能性：', similarity: '類似度', fluency: '流暢さ', completeness: '完全さ',
  },

  coach: {
    title: '文章添削', subtitle: '英文を貼ると、AI が文法を直し、より自然な言い方を提案。読み上げと復習追加も。',
    yourSentence: 'あなたの文', result: '添削結果', placeholder: '例：I very like this movie.',
    aiFix: 'AI 添削', fixing: '添削中…', noResult: 'まだ添削なし', noResultDesc: '英文を入力して「AI 添削」を押してください。', analyzing: '分析中…',
    addReview: 'ミス復習に追加', original: '元の文', corrected: '修正版', moreNatural: 'より自然な言い方', grammarIssues: '文法の問題', alternatives: '別の言い方', examples: '例文',
  },

  scenario: {
    title: 'シーン練習', subtitle: 'リアルなシーンを選び、AI キャラと英語でタスクを達成、即時フィードバック。', loading: 'シーンを読み込み中…',
    minutesN: '{n} 分', voiceSupported: '音声対応', start: '練習開始', again: 'もう一度',
    emptyTitle: 'このカテゴリにシーンなし', emptyDesc: '別のカテゴリをお試しください。',
  },

  vocab: {
    title: '単語システム', subtitle: 'シーン別単語カード：まず英語と発音、答えを表示、例文を聞き、覚えたらマスターか復習へ。',
    loading: '単語を読み込み中…', mastered: '習得した単語', totalWords: '全 {n} 語', currentCat: 'カテゴリ', wordsN: '{n} 語',
    learnProgress: '進捗', thisSet: 'このセット',
  },
  phrase: {
    title: '構文集', subtitle: 'よく使う構文：AI の音声、例文と典型ミスを確認、構文で作文して AI が即チェック。',
    loading: '構文を読み込み中…', mastered: '習得した構文', totalPatterns: '全 {n} 個', thisPage: 'このページ', canCompose: '作文練習',
    examples: '例文', commonMistakes: 'よくある間違い', aiCheck: 'AI チェック', checking: 'チェック中…', composeHint: 'この構文で作文…',
    emptyTitle: 'このレベルに構文なし', emptyDesc: '別のレベルをお試しください。',
  },
  grammar: {
    title: '基礎文法', subtitle: '実践的な文法カード：正しい例と直訳英語の対比、解説とインタラクティブ練習。誤答はミス集へ。',
    loading: '文法を読み込み中…', correct: '正しい', wrong: '誤り', practice: '練習',
    qReference: '解答：', qRight: '正解！', qWrong: 'もう一度', qSubmitted: '送信しました。下の解説を参照', composePlaceholder: 'この構文で作文…', clozePlaceholder: '答えを入力',
  },

  mistakes: {
    title: 'ミス集', subtitle: '会話・添削・文法練習でのミスが自動でここに集まり、分類して復習できます。',
    total: 'ミス総数', accCollected: '蓄積', masteredN: '習得済み', ofN: '全 {n} 件', queue: '復習キュー', queueSub: '復習するミス',
    emptyTitle: 'まだミスがありません', emptyDesc: '会話・文章添削・文法練習をすると、ミスがここに集まります。', recent: '直近 {date}',
  },
  review: {
    title: '復習', subtitle: '間隔反復で単語・構文・ミスを定着：覚えていれば間隔を延ばし、忘れたら翌日に。',
    dueToday: '今日の復習', dueItems: '期限の項目', todayRate: '今日の達成率', reviewedN: '{n} 件復習', mastered: '習得済み', accMastered: '累計習得',
    doneTitle: '今日の復習完了！', doneDesc: '期限の項目はすべて復習済み。新しい単語・構文・会話を学び、明日また。',
    allItems: '全復習項目', recall: '思い出してから表示', remember: '覚えてる', forgot: '忘れた', stillRemember: 'まだ覚えてる？',
    refVocab: '単語', refPhrase: '構文', refMistake: 'ミス文', refSpeaking: 'スピーキング',
  },
  progress: {
    title: '学習状況', subtitle: '練習量・習得度・ミス分布をひと目で。',
    streak: '連続学習', studyTime: '学習時間', acc: '累計', speaking: 'スピーキング', attemptsN: '{n} 回',
    scenariosDone: '完了シーン', convPractice: '会話練習', mastery: '習得度', masteredVocab: '習得単語', masteredPhrases: '習得構文', unit: '個',
    distribution: 'ミスの種類分布', distEmpty: 'ミスのデータなし', distEmptyDesc: '練習でのミスがここで分布図になります。', totalTimes: '合計',
  },

  placement: {
    title: 'レベル診断', subtitle: '2 分の小テストで、AI がレベルを推定し弱点を見つけ、パスを提案。',
    quizN: '{n} 問の診断', quizDesc: '時制・冠詞・前置詞・単語・構文・語感をカバー。完了後にレベルと提案。', startTest: '診断開始',
    answeredN: '回答 {done} / {total}', viewResult: '結果を見る', remainN: '残り {n} 問', retake: '再診断',
    estimated: '推定レベル', weaknesses: '弱点', noWeakness: 'バランス良好 — 目立つ弱点なし！',
    speakingFocus: 'スピーキングの方向', suggestedUnits: 'おすすめユニット', viewPath: '学習パスを見る',
  },
  path: {
    title: '学習パス', subtitle: 'レベルと習得度に応じて、単語・構文・文法・シーンの順番を設計。',
    loading: 'パスを準備中…', overall: '全体の進捗', currentLevel: '現在のレベル', assessed: '診断済み', notAssessed: '未診断',
    masteredSkills: '習得スキル', ofUnits: '全 {n} ユニット', units: '学習ユニット', recommended: 'おすすめ', itemsN: '{n} 項目',
    unitVocab: 'コア単語', unitPhrase: 'よく使う構文', unitGrammar: '基礎文法', unitScenario: '会話',
    skillsHint: '上のユニットを完了（単語/構文で「覚えた」、シーンで会話を完了）するとスキルが解放されます。',
  },
  comingSoon: { phase2: '開発中（Phase 2）', phase2Desc: '完全版は次フェーズで提供（Spring Boot バックエンド＋DB）。データモデルと設計は準備済み。', back: 'ホームへ' },
}
