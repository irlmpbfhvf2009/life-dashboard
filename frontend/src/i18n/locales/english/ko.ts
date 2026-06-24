export default {
  nav: {
    home: '홈', foundation: '기초 학습', practice: 'AI 연습', speaking: '말하기', growth: '복습·성장',
    path: '학습 경로', vocab: '단어', phrases: '패턴', grammar: '문법', missions: '데일리',
    scenarios: '상황 연습', coach: '문장 교정', speakingPractice: '말하기',
    mistakes: '오답 노트', review: '복습', progress: '학습 현황',
  },
  act: {
    all: '전체', read: '재생', readSlow: '느리게', reveal: '정답 보기', collapse: '접기',
    iKnow: '알아요', mastered: '마스터함', addReview: '복습에 추가', added: '추가됨', queued: '복습 대기',
    retry: '다시', submit: '제출', prev: '이전', next: '다음', prevCard: '이전', nextCard: '다음',
    prevSentence: '이전', nextSentence: '다음', backHome: '홈으로', viewAll: '전체 보기',
    start: '시작', restart: '다시 시작',
  },
  mastery: { NEW: '신규', LEARNING: '학습 중', REVIEWING: '복습 중', MASTERED: '마스터' },
  difficulty: { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' },
  level: { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' },
  scat: {
    travel: '여행 영어', restaurant: '레스토랑', hotel: '호텔', airport: '공항', business: '비즈니스',
    interview: '면접', daily: '일상 대화', support: '고객 응대', custom: '사용자 지정',
  },
  mcat: { grammar: '문법', vocab: '단어', tense: '시제', preposition: '전치사', unnatural: '부자연', chinglish: '콩글리시', speech: '말하기' },
  voice: { unsupported: '이 브라우저는 음성 인식을 지원하지 않아 텍스트 입력으로 전환했습니다. 데스크톱 Chrome 또는 Edge에서 전체 말하기 기능을 사용하세요.' },

  home: {
    title: 'AI 영어 튜터', subtitle: '영어로 대화하고, 따라 말하기로 연습하고, 즉시 교정받으세요 — 매일 조금씩.',
    placement: '레벨 진단', quickStart: '바로 시작',
    todayProgress: '오늘 진행률', tasksN: '{done} / {total} 과제',
    streak: '연속 학습', streakDays: '{n} 일', keepStreak: '스트릭 유지',
    weekPractice: '이번 주 연습', minutesN: '{n} 분', studyTime: '학습 시간',
    currentLevel: '현재 레벨', assessed: '진단 완료', notAssessed: '미진단',
    entrySpeakingDesc: '따라 말하기 + 실시간 유사도 피드백', entryCoachDesc: '영어를 붙여넣으면 AI가 자연스럽게', entryReviewDesc: '복습 {n}개',
    recommendedScenarios: '추천 상황', mistakeFocus: '오답 핵심', mistakeLibrary: '오답 노트',
    noMistakes: '아직 오답이 없습니다. 대화나 문장 교정을 시작하면 자동으로 여기에 모입니다.',
  },

  conversation: {
    scenarioList: '상황 목록', goals: '학습 목표', requiredVocab: '필수 단어', usablePhrases: '쓸 수 있는 패턴', voiceMode: '음성 모드',
    progress: '대화 진행', notFound: '상황을 찾을 수 없습니다.', loading: '상황 불러오는 중…',
    placeholder: '영어로 답하기…', finished: '연습 종료',
    hint: '힌트', rephrase: '다르게 말하기', natural: '더 자연스럽게', easier: '쉽게', readOnce: '읽어주기', finish: '종료 후 요약',
    done: '상황 완료 — 학습 현황에 반영됨.',
  },
  feedback: {
    title: '실시간 피드백', empty: '영어 문장을 보내면 문법·자연스러움·패턴 분석이 여기 표시됩니다.',
    patternScore: '패턴 점수', patternScoreSub: '문법 + 자연스러움',
    grammar: '문법 팁', natural: '더 자연스러운 표현', vocab: '단어 제안',
    addReview: '이 오답을 복습에 추가', added: '복습에 추가됨',
  },

  speaking: {
    title: '말하기 연습', subtitle: 'AI를 듣고 마이크로 따라 말하면, 말한 내용을 즉시 대조해 피드백합니다.',
    loading: '문장 불러오는 중…', today: '오늘', accMinutes: '누적 연습 시간', attempts: '음성 시도', totalShadow: '총 따라 말하기',
    progress: '진행', thisSet: '이 세트', attemptsN: '{n}회 시도', startShadow: '마이크로 따라 말하기 시작', manualHint: '말한 내용을 텍스트로 입력',
    target: '목표 문장', youSaid: '인식 결과', missed: '빠뜨리거나 틀린 부분:', similarity: '유사도', fluency: '유창성', completeness: '완성도',
  },

  coach: {
    title: '문장 교정', subtitle: '영어 문장을 붙여넣으면 AI가 문법을 고치고 더 자연스러운 표현을 제안. 읽어주기와 복습 추가도.',
    yourSentence: '내 문장', result: '교정 결과', placeholder: '예: I very like this movie.',
    aiFix: 'AI 교정', fixing: '교정 중…', noResult: '교정 없음', noResultDesc: '문장을 입력하고 "AI 교정"을 누르세요.', analyzing: '분석 중…',
    addReview: '오답 복습에 추가', original: '원문', corrected: '교정본', moreNatural: '더 자연스러운 표현', grammarIssues: '문법 문제', alternatives: '다른 표현', examples: '예문',
  },

  scenario: {
    title: '상황 연습', subtitle: '실제 상황을 골라 AI 캐릭터와 영어로 과제를 완료하고 즉시 피드백을 받으세요.', loading: '상황 불러오는 중…',
    minutesN: '{n}분', voiceSupported: '음성 지원', start: '연습 시작', again: '다시 연습',
    emptyTitle: '이 분류에 상황 없음', emptyDesc: '다른 분류를 보세요.',
  },

  vocab: {
    title: '단어 시스템', subtitle: '상황 단어 카드: 먼저 영어와 발음, 정답 보기, 예문 듣기, 알면 마스터 또는 복습.',
    loading: '단어 불러오는 중…', mastered: '마스터한 단어', totalWords: '총 {n}개', currentCat: '분류', wordsN: '{n}개',
    learnProgress: '진행', thisSet: '이 세트',
  },
  phrase: {
    title: '패턴 모음', subtitle: '자주 쓰는 패턴: AI 음성, 예문과 흔한 실수 확인, 패턴으로 작문해 AI가 즉시 체크.',
    loading: '패턴 불러오는 중…', mastered: '마스터한 패턴', totalPatterns: '총 {n}개', thisPage: '이 페이지', canCompose: '작문 연습',
    examples: '예문', commonMistakes: '흔한 실수', aiCheck: 'AI 체크', checking: '확인 중…', composeHint: '이 패턴으로 작문…',
    emptyTitle: '이 난이도에 패턴 없음', emptyDesc: '다른 난이도를 보세요.',
  },
  grammar: {
    title: '기초 문법', subtitle: '실행 가능한 문법 카드: 올바른 예 vs 콩글리시 대비, 해설과 인터랙티브 연습. 오답은 오답 노트로.',
    loading: '문법 불러오는 중…', correct: '올바름', wrong: '틀림', practice: '연습',
    qReference: '정답: ', qRight: '정답!', qWrong: '다시 생각해 보세요', qSubmitted: '제출됨 — 아래 해설 참고', composePlaceholder: '이 패턴으로 작문…', clozePlaceholder: '정답 입력',
  },

  mistakes: {
    title: '오답 노트', subtitle: '대화·교정·문법 연습의 실수가 자동으로 여기 모여 분류·복습할 수 있습니다.',
    total: '오답 총수', accCollected: '누적', masteredN: '마스터', ofN: '총 {n}개', queue: '복습 대기', queueSub: '복습할 오답',
    emptyTitle: '아직 오답이 없습니다', emptyDesc: '대화방·문장 교정·문법 연습을 하면 실수가 여기 모입니다.', recent: '최근 {date}',
  },
  review: {
    title: '복습', subtitle: '간격 반복으로 단어·패턴·오답 고정: 기억하면 간격을 늘리고, 잊으면 내일 다시.',
    dueToday: '오늘 복습', dueItems: '기한 항목', todayRate: '오늘 완료율', reviewedN: '{n}개 복습', mastered: '마스터', accMastered: '누적 마스터',
    doneTitle: '오늘 복습 완료!', doneDesc: '기한 항목을 모두 복습했어요. 새 단어·패턴·대화를 배우고 내일 다시 오세요.',
    allItems: '전체 복습 항목', recall: '떠올린 뒤 공개', remember: '기억남', forgot: '잊음', stillRemember: '아직 기억나요?',
    refVocab: '단어', refPhrase: '패턴', refMistake: '오답 문장', refSpeaking: '말하기',
  },
  progress: {
    title: '학습 현황', subtitle: '연습량·숙련도·오답 분포를 한눈에.',
    streak: '연속 학습', studyTime: '학습 시간', acc: '누적', speaking: '말하기', attemptsN: '{n}회',
    scenariosDone: '완료 상황', convPractice: '대화 연습', mastery: '숙련도', masteredVocab: '마스터 단어', masteredPhrases: '마스터 패턴', unit: '개',
    distribution: '오답 유형 분포', distEmpty: '오답 데이터 없음', distEmptyDesc: '연습 후 실수가 여기서 분포도가 됩니다.', totalTimes: '합계',
  },

  placement: {
    title: '레벨 진단', subtitle: '2분 퀴즈로 AI가 레벨을 추정하고 약점을 찾아 경로를 추천합니다.',
    quizN: '{n}문항 진단', quizDesc: '시제·관사·전치사·단어·패턴·어감을 다룹니다. 완료 후 레벨과 제안을 드려요.', startTest: '진단 시작',
    answeredN: '응답 {done} / {total}', viewResult: '결과 보기', remainN: '{n}문항 남음', retake: '재진단',
    estimated: '추정 레벨', weaknesses: '약점', noWeakness: '균형 잡혔어요 — 뚜렷한 약점 없음!',
    speakingFocus: '말하기 방향', suggestedUnits: '추천 유닛', viewPath: '학습 경로 보기',
  },
  path: {
    title: '학습 경로', subtitle: '레벨과 숙련도에 따라 단어·패턴·문법·상황 순서를 설계합니다.',
    loading: '경로 준비 중…', overall: '전체 진행', currentLevel: '현재 레벨', assessed: '진단 완료', notAssessed: '미진단',
    masteredSkills: '마스터 스킬', ofUnits: '총 {n} 유닛', units: '학습 유닛', recommended: '추천', itemsN: '{n}개',
    unitVocab: '핵심 단어', unitPhrase: '자주 쓰는 패턴', unitGrammar: '기초 문법', unitScenario: '대화',
    skillsHint: '위 유닛을 완료(단어/패턴에서 "알아요" 표시, 상황에서 대화 완료)하면 스킬이 열립니다.',
  },
  comingSoon: { phase2: '개발 중 (Phase 2)', phase2Desc: '전체 기능은 다음 단계에서 제공됩니다(Spring Boot 백엔드 + DB). 데이터 모델과 디자인은 준비됨.', back: '홈으로' },
}
