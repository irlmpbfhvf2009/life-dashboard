export default {
  nav: {
    home: '首页', foundation: '基础学习', practice: 'AI 练习', speaking: '口说', growth: '复习成长',
    path: '学习路径', vocab: '单词', phrases: '句型', grammar: '语法', missions: '每日任务',
    scenarios: '情境练习', coach: '句子修正', speakingPractice: '口说练习',
    mistakes: '常错库', review: '复习', progress: '学习进度',
  },
  act: {
    all: '全部', read: '朗读', readSlow: '慢速朗读', reveal: '显示答案', collapse: '收起',
    iKnow: '我会了', mastered: '已掌握', addReview: '加入复习', added: '已加入复习', queued: '复习队列中',
    retry: '再试一次', submit: '提交', prev: '上一个', next: '下一个', prevCard: '上一张', nextCard: '下一张',
    prevSentence: '上一句', nextSentence: '下一句', backHome: '回教练首页', viewAll: '查看全部',
    start: '开始', restart: '重新开始',
  },
  mastery: { NEW: '新', LEARNING: '学习中', REVIEWING: '复习中', MASTERED: '已掌握' },
  difficulty: { BEGINNER: '初级', INTERMEDIATE: '中级', ADVANCED: '进阶' },
  level: { BEGINNER: '初级', INTERMEDIATE: '中级', ADVANCED: '进阶' },
  scat: {
    travel: '旅游英文', restaurant: '餐厅点餐', hotel: '酒店入住', airport: '机场通关', business: '商务会议',
    interview: '面试英文', daily: '日常聊天', support: '客服沟通', custom: '自定义情境',
  },
  mcat: { grammar: '语法', vocab: '单词', tense: '时态', preposition: '介词', unnatural: '不自然', chinglish: '中式英文', speech: '口说' },
  voice: { unsupported: '此浏览器不支持语音识别，已自动切换为文字输入模式。建议使用桌面版 Chrome 或 Edge 体验完整口说功能。' },

  home: {
    title: 'AI 英文教练', subtitle: '用英文自然对话、跟读练口说、被即时修正，每天一点一滴累积。',
    placement: '程度检测', quickStart: '快速开始',
    todayProgress: '今日进度', tasksN: '{done} / {total} 任务',
    streak: '连续学习', streakDays: '{n} 天', keepStreak: '保持 streak',
    weekPractice: '本周练习', minutesN: '{n} 分', studyTime: '学习时间',
    currentLevel: '当前程度', assessed: '已检测', notAssessed: '尚未检测',
    entrySpeakingDesc: '跟读 + 即时相似度反馈', entryCoachDesc: '粘贴英文，AI 帮你改更自然', entryReviewDesc: '{n} 项待复习',
    recommendedScenarios: '推荐情境练习', mistakeFocus: '常错重点', mistakeLibrary: '常错库',
    noMistakes: '还没有常错记录——开始一段对话或句子修正，错误会自动收集到这里。',
  },

  conversation: {
    scenarioList: '情境列表', goals: '学习目标', requiredVocab: '必用单词', usablePhrases: '可用句型', voiceMode: '语音模式',
    progress: '对话进度', notFound: '找不到这个情境。', loading: '加载情境…',
    placeholder: '用英文回复…', finished: '练习已结束',
    hint: '给我提示', rephrase: '换个说法', natural: '更自然', easier: '降低难度', readOnce: '念一次', finish: '结束并总结',
    done: '已完成本情境，计入学习进度。',
  },
  feedback: {
    title: '即时反馈', empty: '提交一句英文后，这里会显示语法、自然度与句型分析。',
    patternScore: '句型分数', patternScoreSub: '综合语法与自然度',
    grammar: '语法提醒', natural: '更自然的说法', vocab: '单词建议',
    addReview: '把这个错误加入复习', added: '已加入复习',
  },

  speaking: {
    title: '口说练习', subtitle: '听 AI 朗读，按麦克风跟读，系统即时比对你的发音内容并给反馈。',
    loading: '加载句子…', today: '今日口说', accMinutes: '累积练习时间', attempts: '语音尝试', totalShadow: '总跟读次数',
    progress: '练习进度', thisSet: '本组句子', attemptsN: '尝试 {n} 次', startShadow: '按麦克风开始跟读', manualHint: '改用文字输入你说的句子',
    target: '目标句', youSaid: '你说的（语音识别）', missed: '可能漏掉或说错：', similarity: '相似度', fluency: '流畅度', completeness: '完整度',
  },

  coach: {
    title: '句子修正', subtitle: '粘贴一句英文，AI 帮你修正语法、给更自然的说法，并可朗读与加入复习。',
    yourSentence: '你的句子', result: '修正结果', placeholder: '例如：I very like this movie.',
    aiFix: 'AI 修正', fixing: '修正中…', noResult: '尚无修正', noResultDesc: '输入一句英文并按「AI 修正」。', analyzing: '分析中…',
    addReview: '加入常错复习', original: '原句', corrected: '修正版', moreNatural: '更自然的说法', grammarIssues: '语法问题', alternatives: '其他说法', examples: '例句',
  },

  scenario: {
    title: '情境练习', subtitle: '挑一个真实情境，和 AI 角色用英文完成任务并获得即时反馈。', loading: '加载情境…',
    minutesN: '{n} 分钟', voiceSupported: '支持语音', start: '开始练习', again: '再练一次',
    emptyTitle: '此分类暂无情境', emptyDesc: '换个分类看看。',
  },

  vocab: {
    title: '单词系统', subtitle: '情境单词卡：先看英文与发音，揭晓答案、听例句，会了就标记掌握或加入复习。',
    loading: '加载单词…', mastered: '已掌握单词', totalWords: '共 {n} 词', currentCat: '当前分类', wordsN: '{n} 词',
    learnProgress: '学习进度', thisSet: '本组单词',
  },
  phrase: {
    title: '句型库', subtitle: '学常用句型：听 AI 念、看例句与常见错误，再用句型造句让 AI 即时检查。',
    loading: '加载句型…', mastered: '已掌握句型', totalPatterns: '共 {n} 个', thisPage: '本页句型', canCompose: '可造句练习',
    examples: '例句', commonMistakes: '常见错误', aiCheck: 'AI 检查', checking: '检查中…', composeHint: '用这个句型造句…',
    emptyTitle: '此难度暂无句型', emptyDesc: '换个难度看看。',
  },
  grammar: {
    title: '基础语法', subtitle: '可行动的语法卡：正确 vs 中式英文对照、中文解析与互动练习；答错自动收进常错库。',
    loading: '加载语法…', correct: '正确', wrong: '错误', practice: '小练习',
    qReference: '参考答案：', qRight: '答对了！', qWrong: '再想想', qSubmitted: '已提交，参考下方解析', composePlaceholder: '用这个句型造句…', clozePlaceholder: '填入答案',
  },

  mistakes: {
    title: '常错库', subtitle: '对话、句子修正与语法练习中的错误会自动收集到这里，分类整理、加入复习。',
    total: '常错总数', accCollected: '累积收集', masteredN: '已掌握', ofN: '共 {n} 项', queue: '复习队列', queueSub: '待复习的常错',
    emptyTitle: '目前没有常错记录', emptyDesc: '去对话室、句子修正或语法练习，犯的错会自动收集到这里。', recent: '最近 {date}',
  },
  review: {
    title: '复习', subtitle: '用间隔复习巩固单词、句型与常错句：记得就拉长间隔，忘记就明天再来。',
    dueToday: '今日待复习', dueItems: '到期项目', todayRate: '今日完成率', reviewedN: '已复习 {n} 项', mastered: '已掌握', accMastered: '累积掌握',
    doneTitle: '今日复习完成！', doneDesc: '所有到期项目都复习过了。去学新单词、句型或对话，明天再回来复习。',
    allItems: '全部复习项目', recall: '回想看看，再揭晓', remember: '记得', forgot: '忘记了', stillRemember: '还记得吗？',
    refVocab: '单词', refPhrase: '句型', refMistake: '常错句', refSpeaking: '口说',
  },
  progress: {
    title: '学习进度', subtitle: '你的练习量、掌握程度与常错分布，一览学习轨迹。',
    streak: '连续学习', studyTime: '学习时间', acc: '累积', speaking: '口说练习', attemptsN: '{n} 次尝试',
    scenariosDone: '完成情境', convPractice: '对话练习', mastery: '掌握程度', masteredVocab: '掌握单词', masteredPhrases: '掌握句型', unit: '个',
    distribution: '常错类型分布', distEmpty: '尚无常错数据', distEmptyDesc: '练习后犯的错会在这里形成分布图。', totalTimes: '总次数',
  },

  placement: {
    title: '程度检测', subtitle: '花两分钟做几题，AI 帮你推估程度、找出弱点并推荐学习路径。',
    quizN: '{n} 题快速检测', quizDesc: '涵盖时态、冠词、介词、单词、句型与语感。完成后给你程度与建议。', startTest: '开始检测',
    answeredN: '已作答 {done} / {total}', viewResult: '查看结果', remainN: '还有 {n} 题', retake: '重新检测',
    estimated: '推估程度', weaknesses: '常见弱点', noWeakness: '表现很均衡，没有明显弱点！',
    speakingFocus: '口说建议方向', suggestedUnits: '建议先学的单元', viewPath: '查看学习路径',
  },
  path: {
    title: '学习路径', subtitle: '依你的程度与掌握进度，安排单词、句型、语法与情境的学习顺序。',
    loading: '整理你的学习路径…', overall: '整体进度', currentLevel: '当前程度', assessed: '已检测', notAssessed: '尚未检测',
    masteredSkills: '已掌握技能', ofUnits: '共 {n} 单元', units: '学习单元', recommended: '推荐', itemsN: '{n} 项',
    unitVocab: '核心单词', unitPhrase: '常用句型', unitGrammar: '基础语法', unitScenario: '情境对话',
    skillsHint: '完成上面的单元（在单词/句型页标记「我会了」、在情境完成对话）就会解锁技能。',
  },
  comingSoon: { phase2: 'Phase 2 开发中', phase2Desc: '此页的完整体验会在下一阶段完成（接 Spring Boot 后端与数据库）。数据模型与设计已就绪。', back: '回教练首页' },
}
