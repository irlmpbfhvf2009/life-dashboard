export default {
  nav: {
    home: 'Home', foundation: 'Foundation', practice: 'AI Practice', speaking: 'Speaking', growth: 'Growth',
    path: 'Learning Path', vocab: 'Vocabulary', phrases: 'Phrases', grammar: 'Grammar', missions: 'Daily Mission',
    scenarios: 'Scenarios', coach: 'Sentence Coach', speakingPractice: 'Speaking',
    mistakes: 'Mistakes', review: 'Review', progress: 'Progress',
  },
  act: {
    all: 'All', read: 'Play', readSlow: 'Slow', reveal: 'Show answer', collapse: 'Collapse',
    iKnow: 'I know this', mastered: 'Mastered', addReview: 'Add to review', added: 'Added', queued: 'In review queue',
    retry: 'Try again', submit: 'Submit', prev: 'Previous', next: 'Next', prevCard: 'Previous', nextCard: 'Next',
    prevSentence: 'Previous', nextSentence: 'Next', backHome: 'Back to home', viewAll: 'View all',
    start: 'Start', restart: 'Restart',
  },
  mastery: { NEW: 'New', LEARNING: 'Learning', REVIEWING: 'Reviewing', MASTERED: 'Mastered' },
  difficulty: { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' },
  level: { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' },
  scat: {
    travel: 'Travel', restaurant: 'Restaurant', hotel: 'Hotel', airport: 'Airport', business: 'Business',
    interview: 'Interview', daily: 'Daily chat', support: 'Customer support', custom: 'Custom',
  },
  mcat: { grammar: 'Grammar', vocab: 'Vocabulary', tense: 'Tense', preposition: 'Preposition', unnatural: 'Unnatural', chinglish: 'Chinglish', speech: 'Speaking' },
  voice: { unsupported: 'This browser does not support speech recognition — switched to text input. Use desktop Chrome or Edge for the full speaking experience.', stop: 'Stop', hold: 'Hold to speak', micUnsupported: 'Speech input not supported in this browser' },

  home: {
    title: 'AI English Coach', subtitle: 'Chat in English, shadow to practice speaking, get corrected live — a little every day.',
    placement: 'Placement test', quickStart: 'Quick start',
    todayProgress: "Today's progress", tasksN: '{done} / {total} tasks',
    streak: 'Streak', streakDays: '{n} days', keepStreak: 'Keep the streak',
    weekPractice: 'This week', minutesN: '{n} min', studyTime: 'Study time',
    currentLevel: 'Your level', assessed: 'Assessed', notAssessed: 'Not assessed',
    entrySpeakingDesc: 'Shadowing + live similarity feedback', entryCoachDesc: 'Paste English, AI makes it natural', entryReviewDesc: '{n} items to review',
    recommendedScenarios: 'Recommended scenarios', mistakeFocus: 'Mistake focus', mistakeLibrary: 'Mistake Library',
    noMistakes: 'No mistakes yet — start a conversation or sentence correction and they will be collected here.',
  },

  conversation: {
    scenarioList: 'Scenarios', goals: 'Goals', requiredVocab: 'Key vocabulary', usablePhrases: 'Useful phrases', voiceMode: 'Voice mode',
    progress: 'Conversation progress', notFound: 'Scenario not found.', loading: 'Loading scenario…',
    placeholder: 'Reply in English…', finished: 'Practice ended',
    hint: 'Give me a hint', rephrase: 'Rephrase', natural: 'More natural', easier: 'Make it easier', readOnce: 'Read it', finish: 'Finish & summarize',
    done: 'Scenario completed — counted toward your progress.',
  },
  feedback: {
    title: 'Live feedback', empty: 'Send an English sentence and grammar, naturalness and pattern analysis appear here.',
    patternScore: 'Pattern score', patternScoreSub: 'Grammar + naturalness',
    grammar: 'Grammar tips', natural: 'More natural', vocab: 'Vocabulary',
    addReview: 'Add this mistake to review', added: 'Added to review',
  },

  speaking: {
    title: 'Speaking Practice', subtitle: 'Listen to the AI, tap the mic to shadow, and get instant feedback on what you said.',
    loading: 'Loading sentences…', today: 'Today', accMinutes: 'Accumulated practice', attempts: 'Attempts', totalShadow: 'Total shadowing',
    progress: 'Progress', thisSet: 'This set', attemptsN: '{n} attempts', startShadow: 'Tap the mic to shadow', manualHint: 'Type what you said instead',
    target: 'Target', youSaid: 'You said (recognized)', missed: 'Possibly missed or mis-said:', similarity: 'Similarity', fluency: 'Fluency', completeness: 'Completeness',
  },

  coach: {
    title: 'Sentence Coach', subtitle: 'Paste an English sentence — AI fixes grammar, suggests natural phrasing, reads it aloud and adds to review.',
    yourSentence: 'Your sentence', result: 'Result', placeholder: 'e.g. I very like this movie.',
    aiFix: 'AI fix', fixing: 'Fixing…', noResult: 'No correction yet', noResultDesc: 'Enter a sentence and tap "AI fix".', analyzing: 'Analyzing…',
    addReview: 'Add to mistake review', original: 'Original', corrected: 'Corrected', moreNatural: 'More natural', grammarIssues: 'Grammar issues', alternatives: 'Alternatives', examples: 'Examples',
  },

  scenario: {
    title: 'Scenarios', subtitle: 'Pick a real-life scenario, complete the task in English with an AI character, and get live feedback.', loading: 'Loading scenarios…',
    minutesN: '{n} min', voiceSupported: 'Voice supported', start: 'Start', again: 'Practice again',
    emptyTitle: 'No scenarios in this category', emptyDesc: 'Try another category.',
  },

  vocab: {
    title: 'Vocabulary', subtitle: 'Situational word cards: see the word and pronunciation first, reveal the answer, hear examples, then master or review.',
    loading: 'Loading words…', mastered: 'Mastered words', totalWords: '{n} total', currentCat: 'Category', wordsN: '{n} words',
    learnProgress: 'Progress', thisSet: 'This set',
  },
  phrase: {
    title: 'Phrase Bank', subtitle: 'Learn common patterns: hear the AI, see examples and common mistakes, then compose with live AI checking.',
    loading: 'Loading phrases…', mastered: 'Mastered patterns', totalPatterns: '{n} total', thisPage: 'On this page', canCompose: 'compose practice',
    examples: 'Examples', commonMistakes: 'Common mistakes', aiCheck: 'AI check', checking: 'Checking…', composeHint: 'Compose with this pattern…',
    emptyTitle: 'No patterns at this level', emptyDesc: 'Try another level.',
  },
  grammar: {
    title: 'Grammar Basics', subtitle: 'Actionable grammar cards: correct vs Chinglish examples, explanations and interactive practice; wrong answers go to the Mistake Library.',
    loading: 'Loading grammar…', correct: 'Correct', wrong: 'Wrong', practice: 'Practice',
    qReference: 'Answer: ', qRight: 'Correct!', qWrong: 'Try again', qSubmitted: 'Submitted — see explanation below', composePlaceholder: 'Compose with this pattern…', clozePlaceholder: 'Fill in the answer',
  },

  mistakes: {
    title: 'Mistake Library', subtitle: 'Mistakes from conversations, corrections and grammar practice are collected here, categorized and reviewable.',
    total: 'Total mistakes', accCollected: 'Collected', masteredN: 'Mastered', ofN: '{n} total', queue: 'Review queue', queueSub: 'Mistakes to review',
    emptyTitle: 'No mistakes yet', emptyDesc: 'Go to the conversation room, sentence coach or grammar practice — mistakes are collected here.', recent: 'Last seen {date}',
  },
  review: {
    title: 'Review', subtitle: 'Spaced repetition to lock in words, patterns and mistakes: remember → longer interval; forgot → tomorrow.',
    dueToday: 'Due today', dueItems: 'due items', todayRate: "Today's rate", reviewedN: '{n} reviewed', mastered: 'Mastered', accMastered: 'Total mastered',
    doneTitle: 'Done for today!', doneDesc: 'All due items reviewed. Learn new words, patterns or conversations and come back tomorrow.',
    allItems: 'All review items', recall: 'Recall, then reveal', remember: 'Remembered', forgot: 'Forgot', stillRemember: 'Still remember?',
    refVocab: 'Vocab', refPhrase: 'Phrase', refMistake: 'Mistake', refSpeaking: 'Speaking',
  },
  progress: {
    title: 'Progress', subtitle: 'Your practice volume, mastery and mistake distribution at a glance.',
    streak: 'Streak', studyTime: 'Study time', acc: 'Total', speaking: 'Speaking', attemptsN: '{n} attempts',
    scenariosDone: 'Scenarios done', convPractice: 'Conversation', mastery: 'Mastery', masteredVocab: 'Mastered words', masteredPhrases: 'Mastered patterns', unit: '',
    distribution: 'Mistake distribution', distEmpty: 'No mistake data yet', distEmptyDesc: 'Mistakes from practice form a distribution here.', totalTimes: 'Total',
  },

  placement: {
    title: 'Placement Test', subtitle: 'A two-minute quiz — AI estimates your level, finds weak spots and recommends a path.',
    quizN: '{n}-question quiz', quizDesc: 'Covers tense, articles, prepositions, vocabulary, patterns and intuition. You get a level and suggestions.', startTest: 'Start test',
    answeredN: 'Answered {done} / {total}', viewResult: 'View result', remainN: '{n} left', retake: 'Retake',
    estimated: 'Estimated level', weaknesses: 'Weak spots', noWeakness: 'Well balanced — no obvious weaknesses!',
    speakingFocus: 'Speaking focus', suggestedUnits: 'Suggested units', viewPath: 'View learning path',
  },
  path: {
    title: 'Learning Path', subtitle: 'Vocabulary, phrases, grammar and scenarios ordered by your level and mastery.',
    loading: 'Building your path…', overall: 'Overall progress', currentLevel: 'Your level', assessed: 'Assessed', notAssessed: 'Not assessed',
    masteredSkills: 'Mastered skills', ofUnits: '{n} units', units: 'Learning units', recommended: 'Recommended', itemsN: '{n} items',
    unitVocab: 'Core vocabulary', unitPhrase: 'Common patterns', unitGrammar: 'Grammar basics', unitScenario: 'Conversation',
    skillsHint: 'Finish the units above (mark "I know this" in vocab/phrases, complete conversations) to unlock skills.',
  },
  mission: { title: 'Daily Mission', sub: 'Keep your daily learning rhythm', doneN: '{done} / {total} done' },
  comingSoon: { phase2: 'In development (Phase 2)', phase2Desc: 'The full experience ships next phase (Spring Boot backend + database). The data model and design are ready.', back: 'Back to home' },
}
