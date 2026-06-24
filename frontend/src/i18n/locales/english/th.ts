export default {
  nav: {
    home: 'หน้าแรก', foundation: 'พื้นฐาน', practice: 'ฝึกกับ AI', speaking: 'การพูด', growth: 'ทบทวน',
    path: 'เส้นทางเรียน', vocab: 'คำศัพท์', phrases: 'รูปประโยค', grammar: 'ไวยากรณ์', missions: 'ภารกิจวันนี้',
    scenarios: 'สถานการณ์', coach: 'แก้ประโยค', speakingPractice: 'ฝึกพูด',
    mistakes: 'คลังที่ผิดบ่อย', review: 'ทบทวน', progress: 'ความคืบหน้า',
  },
  act: {
    all: 'ทั้งหมด', read: 'เล่น', readSlow: 'ช้า', reveal: 'ดูเฉลย', collapse: 'ย่อ',
    iKnow: 'รู้แล้ว', mastered: 'เชี่ยวชาญแล้ว', addReview: 'เพิ่มไปทบทวน', added: 'เพิ่มแล้ว', queued: 'อยู่ในคิวทบทวน',
    retry: 'ลองอีกครั้ง', submit: 'ส่ง', prev: 'ก่อนหน้า', next: 'ถัดไป', prevCard: 'ก่อนหน้า', nextCard: 'ถัดไป',
    prevSentence: 'ก่อนหน้า', nextSentence: 'ถัดไป', backHome: 'กลับหน้าแรก', viewAll: 'ดูทั้งหมด',
    start: 'เริ่ม', restart: 'เริ่มใหม่',
  },
  mastery: { NEW: 'ใหม่', LEARNING: 'กำลังเรียน', REVIEWING: 'กำลังทบทวน', MASTERED: 'เชี่ยวชาญ' },
  difficulty: { BEGINNER: 'เริ่มต้น', INTERMEDIATE: 'กลาง', ADVANCED: 'สูง' },
  level: { BEGINNER: 'เริ่มต้น', INTERMEDIATE: 'กลาง', ADVANCED: 'สูง' },
  scat: {
    travel: 'ท่องเที่ยว', restaurant: 'ร้านอาหาร', hotel: 'โรงแรม', airport: 'สนามบิน', business: 'ธุรกิจ',
    interview: 'สัมภาษณ์งาน', daily: 'คุยทั่วไป', support: 'บริการลูกค้า', custom: 'กำหนดเอง',
  },
  mcat: { grammar: 'ไวยากรณ์', vocab: 'คำศัพท์', tense: 'กาล', preposition: 'บุพบท', unnatural: 'ไม่เป็นธรรมชาติ', chinglish: 'อังกฤษแบบแปลตรง', speech: 'การพูด' },
  voice: { unsupported: 'เบราว์เซอร์นี้ไม่รองรับการรู้จำเสียง จึงสลับเป็นพิมพ์ข้อความ แนะนำ Chrome หรือ Edge บนเดสก์ท็อปเพื่อใช้ฟีเจอร์พูดเต็มรูปแบบ' },

  home: {
    title: 'ติวเตอร์ภาษาอังกฤษ AI', subtitle: 'สนทนาเป็นภาษาอังกฤษ ฝึกพูดตาม และแก้ให้ทันที — ทีละนิดทุกวัน',
    placement: 'วัดระดับ', quickStart: 'เริ่มเลย',
    todayProgress: 'ความคืบหน้าวันนี้', tasksN: '{done} / {total} ภารกิจ',
    streak: 'เรียนต่อเนื่อง', streakDays: '{n} วัน', keepStreak: 'รักษาสตรีค',
    weekPractice: 'สัปดาห์นี้', minutesN: '{n} นาที', studyTime: 'เวลาเรียน',
    currentLevel: 'ระดับปัจจุบัน', assessed: 'วัดแล้ว', notAssessed: 'ยังไม่วัด',
    entrySpeakingDesc: 'พูดตาม + ผลความใกล้เคียงทันที', entryCoachDesc: 'วางภาษาอังกฤษ AI ปรับให้เป็นธรรมชาติ', entryReviewDesc: 'ทบทวน {n} รายการ',
    recommendedScenarios: 'สถานการณ์แนะนำ', mistakeFocus: 'จุดผิดสำคัญ', mistakeLibrary: 'คลังที่ผิดบ่อย',
    noMistakes: 'ยังไม่มีข้อผิดพลาด เริ่มสนทนาหรือแก้ประโยค แล้วระบบจะเก็บไว้ที่นี่อัตโนมัติ',
  },

  conversation: {
    scenarioList: 'รายการสถานการณ์', goals: 'เป้าหมาย', requiredVocab: 'คำศัพท์ที่ต้องใช้', usablePhrases: 'รูปประโยคที่ใช้ได้', voiceMode: 'โหมดเสียง',
    progress: 'ความคืบหน้าการสนทนา', notFound: 'ไม่พบสถานการณ์นี้', loading: 'กำลังโหลดสถานการณ์…',
    placeholder: 'ตอบเป็นภาษาอังกฤษ…', finished: 'จบการฝึก',
    hint: 'ขอคำใบ้', rephrase: 'พูดอีกแบบ', natural: 'เป็นธรรมชาติขึ้น', easier: 'ง่ายลง', readOnce: 'อ่านให้ฟัง', finish: 'จบและสรุป',
    done: 'ทำสถานการณ์เสร็จ — นับเข้าความคืบหน้าแล้ว',
  },
  feedback: {
    title: 'ผลตอบกลับทันที', empty: 'ส่งประโยคภาษาอังกฤษแล้ว การวิเคราะห์ไวยากรณ์ ความเป็นธรรมชาติ และรูปประโยคจะแสดงที่นี่',
    patternScore: 'คะแนนรูปประโยค', patternScoreSub: 'ไวยากรณ์ + ความเป็นธรรมชาติ',
    grammar: 'คำแนะนำไวยากรณ์', natural: 'วิธีพูดที่เป็นธรรมชาติกว่า', vocab: 'คำศัพท์แนะนำ',
    addReview: 'เพิ่มข้อผิดนี้ไปทบทวน', added: 'เพิ่มไปทบทวนแล้ว',
  },

  speaking: {
    title: 'ฝึกพูด', subtitle: 'ฟัง AI กดไมค์พูดตาม ระบบเทียบสิ่งที่คุณพูดทันทีและให้ผลตอบกลับ',
    loading: 'กำลังโหลดประโยค…', today: 'วันนี้', accMinutes: 'เวลาฝึกสะสม', attempts: 'ครั้งที่พูด', totalShadow: 'พูดตามทั้งหมด',
    progress: 'ความคืบหน้า', thisSet: 'ชุดนี้', attemptsN: 'พยายาม {n} ครั้ง', startShadow: 'กดไมค์เพื่อพูดตาม', manualHint: 'พิมพ์สิ่งที่คุณพูดแทน',
    target: 'ประโยคเป้าหมาย', youSaid: 'ผลการรู้จำเสียง', missed: 'อาจตกหล่นหรือพูดผิด:', similarity: 'ความใกล้เคียง', fluency: 'ความคล่อง', completeness: 'ความครบถ้วน',
  },

  coach: {
    title: 'แก้ประโยค', subtitle: 'วางประโยคภาษาอังกฤษ AI แก้ไวยากรณ์ แนะนำวิธีพูดที่เป็นธรรมชาติ อ่านให้ฟังและเพิ่มไปทบทวน',
    yourSentence: 'ประโยคของคุณ', result: 'ผลการแก้', placeholder: 'เช่น I very like this movie.',
    aiFix: 'แก้ด้วย AI', fixing: 'กำลังแก้…', noResult: 'ยังไม่มีการแก้', noResultDesc: 'พิมพ์ประโยคแล้วกด "แก้ด้วย AI"', analyzing: 'กำลังวิเคราะห์…',
    addReview: 'เพิ่มไปทบทวนที่ผิดบ่อย', original: 'ประโยคเดิม', corrected: 'ฉบับแก้', moreNatural: 'วิธีพูดที่เป็นธรรมชาติกว่า', grammarIssues: 'ปัญหาไวยากรณ์', alternatives: 'วิธีพูดอื่น', examples: 'ตัวอย่าง',
  },

  scenario: {
    title: 'สถานการณ์', subtitle: 'เลือกสถานการณ์จริง ทำภารกิจเป็นภาษาอังกฤษกับตัวละคร AI และรับผลตอบกลับทันที', loading: 'กำลังโหลดสถานการณ์…',
    minutesN: '{n} นาที', voiceSupported: 'รองรับเสียง', start: 'เริ่มฝึก', again: 'ฝึกอีกครั้ง',
    emptyTitle: 'หมวดนี้ยังไม่มีสถานการณ์', emptyDesc: 'ลองหมวดอื่นดู',
  },

  vocab: {
    title: 'ระบบคำศัพท์', subtitle: 'การ์ดคำศัพท์ตามสถานการณ์: ดูคำและการออกเสียงก่อน เปิดเฉลย ฟังตัวอย่าง แล้วทำเครื่องหมายว่ารู้หรือเพิ่มไปทบทวน',
    loading: 'กำลังโหลดคำศัพท์…', mastered: 'คำที่เชี่ยวชาญ', totalWords: 'ทั้งหมด {n} คำ', currentCat: 'หมวด', wordsN: '{n} คำ',
    learnProgress: 'ความคืบหน้า', thisSet: 'ชุดนี้',
  },
  phrase: {
    title: 'คลังรูปประโยค', subtitle: 'เรียนรูปประโยคที่ใช้บ่อย: ฟัง AI ดูตัวอย่างและข้อผิดที่พบบ่อย แล้วแต่งประโยคให้ AI ตรวจทันที',
    loading: 'กำลังโหลดรูปประโยค…', mastered: 'รูปประโยคที่เชี่ยวชาญ', totalPatterns: 'ทั้งหมด {n} รูป', thisPage: 'หน้านี้', canCompose: 'ฝึกแต่งประโยค',
    examples: 'ตัวอย่าง', commonMistakes: 'ข้อผิดที่พบบ่อย', aiCheck: 'ตรวจด้วย AI', checking: 'กำลังตรวจ…', composeHint: 'แต่งประโยคด้วยรูปนี้…',
    emptyTitle: 'ระดับนี้ยังไม่มีรูปประโยค', emptyDesc: 'ลองระดับอื่นดู',
  },
  grammar: {
    title: 'ไวยากรณ์พื้นฐาน', subtitle: 'การ์ดไวยากรณ์ที่ลงมือได้: เทียบประโยคถูกกับอังกฤษแบบแปลตรง คำอธิบายและแบบฝึกโต้ตอบ ตอบผิดเข้าคลังที่ผิดบ่อยอัตโนมัติ',
    loading: 'กำลังโหลดไวยากรณ์…', correct: 'ถูก', wrong: 'ผิด', practice: 'แบบฝึก',
    qReference: 'เฉลย: ', qRight: 'ถูกต้อง!', qWrong: 'ลองคิดอีกที', qSubmitted: 'ส่งแล้ว — ดูคำอธิบายด้านล่าง', composePlaceholder: 'แต่งประโยคด้วยรูปนี้…', clozePlaceholder: 'เติมคำตอบ',
  },

  mistakes: {
    title: 'คลังที่ผิดบ่อย', subtitle: 'ข้อผิดจากการสนทนา การแก้ประโยค และการฝึกไวยากรณ์จะถูกเก็บที่นี่อัตโนมัติ จัดหมวดและทบทวนได้',
    total: 'ข้อผิดทั้งหมด', accCollected: 'สะสม', masteredN: 'เชี่ยวชาญ', ofN: 'ทั้งหมด {n} รายการ', queue: 'คิวทบทวน', queueSub: 'ข้อผิดที่จะทบทวน',
    emptyTitle: 'ยังไม่มีข้อผิด', emptyDesc: 'ไปที่ห้องสนทนา แก้ประโยค หรือฝึกไวยากรณ์ ข้อผิดจะถูกเก็บที่นี่', recent: 'ล่าสุด {date}',
  },
  review: {
    title: 'ทบทวน', subtitle: 'ทบทวนแบบเว้นระยะเพื่อจำคำศัพท์ รูปประโยค และข้อผิด: จำได้ขยายระยะ ลืมแล้วพรุ่งนี้เจอใหม่',
    dueToday: 'ทบทวนวันนี้', dueItems: 'รายการถึงกำหนด', todayRate: 'อัตราเสร็จวันนี้', reviewedN: 'ทบทวนแล้ว {n} รายการ', mastered: 'เชี่ยวชาญ', accMastered: 'เชี่ยวชาญสะสม',
    doneTitle: 'ทบทวนวันนี้เสร็จ!', doneDesc: 'ทบทวนรายการถึงกำหนดครบแล้ว ไปเรียนคำ รูปประโยค หรือบทสนทนาใหม่ แล้วพรุ่งนี้กลับมา',
    allItems: 'รายการทบทวนทั้งหมด', recall: 'นึกดูก่อนแล้วเปิดเฉลย', remember: 'จำได้', forgot: 'ลืม', stillRemember: 'ยังจำได้ไหม?',
    refVocab: 'คำศัพท์', refPhrase: 'รูปประโยค', refMistake: 'ประโยคที่ผิด', refSpeaking: 'การพูด',
  },
  progress: {
    title: 'ความคืบหน้า', subtitle: 'ปริมาณการฝึก ความเชี่ยวชาญ และการกระจายข้อผิด ในมุมมองเดียว',
    streak: 'เรียนต่อเนื่อง', studyTime: 'เวลาเรียน', acc: 'สะสม', speaking: 'การพูด', attemptsN: '{n} ครั้ง',
    scenariosDone: 'สถานการณ์ที่เสร็จ', convPractice: 'ฝึกสนทนา', mastery: 'ความเชี่ยวชาญ', masteredVocab: 'คำที่เชี่ยวชาญ', masteredPhrases: 'รูปที่เชี่ยวชาญ', unit: '',
    distribution: 'การกระจายชนิดข้อผิด', distEmpty: 'ยังไม่มีข้อมูลข้อผิด', distEmptyDesc: 'ข้อผิดจากการฝึกจะกลายเป็นแผนภูมิที่นี่', totalTimes: 'รวม',
  },

  placement: {
    title: 'วัดระดับ', subtitle: 'แบบทดสอบสองนาที AI ประเมินระดับ หาจุดอ่อน และแนะนำเส้นทาง',
    quizN: 'แบบทดสอบ {n} ข้อ', quizDesc: 'ครอบคลุมกาล คำนำหน้านาม บุพบท คำศัพท์ รูปประโยค และความรู้สึกทางภาษา เสร็จแล้วได้ระดับและคำแนะนำ', startTest: 'เริ่มทดสอบ',
    answeredN: 'ตอบแล้ว {done} / {total}', viewResult: 'ดูผล', remainN: 'เหลือ {n} ข้อ', retake: 'ทดสอบใหม่',
    estimated: 'ระดับโดยประมาณ', weaknesses: 'จุดอ่อน', noWeakness: 'สมดุลดี — ไม่มีจุดอ่อนชัดเจน!',
    speakingFocus: 'แนวทางการพูด', suggestedUnits: 'ยูนิตแนะนำ', viewPath: 'ดูเส้นทางเรียน',
  },
  path: {
    title: 'เส้นทางเรียน', subtitle: 'จัดลำดับคำศัพท์ รูปประโยค ไวยากรณ์ และสถานการณ์ตามระดับและความเชี่ยวชาญ',
    loading: 'กำลังจัดเส้นทาง…', overall: 'ความคืบหน้ารวม', currentLevel: 'ระดับปัจจุบัน', assessed: 'วัดแล้ว', notAssessed: 'ยังไม่วัด',
    masteredSkills: 'ทักษะที่เชี่ยวชาญ', ofUnits: 'ทั้งหมด {n} ยูนิต', units: 'ยูนิตการเรียน', recommended: 'แนะนำ', itemsN: '{n} รายการ',
    unitVocab: 'คำศัพท์หลัก', unitPhrase: 'รูปประโยคที่ใช้บ่อย', unitGrammar: 'ไวยากรณ์พื้นฐาน', unitScenario: 'บทสนทนา',
    skillsHint: 'ทำยูนิตด้านบนให้เสร็จ (กด "รู้แล้ว" ในคำศัพท์/รูปประโยค ทำบทสนทนาในสถานการณ์ให้เสร็จ) เพื่อปลดล็อกทักษะ',
  },
  comingSoon: { phase2: 'กำลังพัฒนา (Phase 2)', phase2Desc: 'ประสบการณ์เต็มจะมาในเฟสถัดไป (แบ็กเอนด์ Spring Boot + ฐานข้อมูล) โมเดลข้อมูลและดีไซน์พร้อมแล้ว', back: 'กลับหน้าแรก' },
}
