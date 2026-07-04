// The training + two-meal (168/18:6) program model. A plan is *generated* from a
// goal template (減脂 / 增肌 / 維持) + a start date + a number of weeks, so the
// user can pick their own program instead of a single hard-coded template.
// Persisted per user (localStorage + backend plan_state, cross-device); the
// frontend owns this schema, the backend stores it as an opaque JSON document.

export type PlanGoal = 'cut' | 'gain' | 'maintain'

export interface PlanDayDone {
  am: boolean // 早上運動
  meal1: boolean // 第一餐
  gym: boolean // 晚上健身
  meal2: boolean // 第二餐
}

export interface PlanDay {
  date: string // YYYY-MM-DD (Asia/Taipei)
  am: string // 早上運動描述（休息時為「休息」）
  amMin: number // 早上運動分鐘數（0＝不安排晨間有氧）
  gym: string // 晚上健身房內容
  meal1: string // 第一餐內容
  meal2: string // 第二餐內容
  waterMl: string // 每日喝水量（範圍字串）
  note: string // 注意事項
  done: PlanDayDone
}

export interface TrainingPlan {
  version: number
  goal: PlanGoal
  weeks: number
  title: string
  startDate: string
  endDate: string
  targetLabel: string // 目標，如 "75.5–77.5 kg"
  calorieLabel: string // 每日熱量目標
  proteinLabel: string // 每日蛋白質目標
  days: PlanDay[]
}

export const PLAN_VERSION = 2

/** Fixed default times used both in the UI and the .ics export (Asia/Taipei). */
export const PLAN_TIMES = {
  am: '06:30', // 早上運動起始
  meal1: '12:00', // 第一餐
  gym: '18:00', // 晚上健身
  meal2: '19:00', // 第二餐（20:00 前吃完）
} as const

/** 訓練分項說明（跨目標共用；早上有氧/休息不需說明）。 */
export const WORKOUT_LEGEND: { key: string; label: string; detail: string }[] = [
  { key: 'full', label: '全身訓練', detail: '腿推3×10-12、胸推機3、滑輪下拉3、坐姿划船3、啞鈴肩推3、棒式3×30-45秒、坡度快走15分' },
  { key: 'push', label: '推（胸肩三頭）', detail: '胸推機4、上斜啞鈴推3、肩推3、側平舉4、三頭下壓3、坡度快走15-20分' },
  { key: 'pull', label: '拉（背二頭）', detail: '滑輪下拉4、坐姿划船4、啞鈴划船3、面拉3、二頭彎舉3、坡度快走15-20分' },
  { key: 'legs', label: '腿＋核心', detail: '腿推4、羅馬尼亞硬舉3、腿屈伸3、腿後勾3、小腿4、棒式3、捲腹3' },
]

// Shared protein rotations; goal只調整澱粉份量與有氧/訓練頻率。
const M1_PROTEIN = ['雞胸220g＋蛋2', '鮭魚230g＋蛋1', '牛肉220g＋蛋2', '豬里肌220g＋蛋1', '去皮雞腿230g＋蛋2']
const M2_PROTEIN = ['雞胸220g', '白肉魚230g', '瘦牛220g', '豆腐+雞胸240g']

interface GoalTemplate {
  label: string
  emoji: string
  targetLabel: string
  calorieLabel: string
  proteinLabel: string
  water: string
  starch1: string // 第一餐澱粉
  starch2: string // 第二餐澱粉
  dayNote: string // 一般訓練日提醒
  gymCycle: string[] // 7 天循環的晚間健身內容
  cardioCycle: { am: string; amMin: number }[] // 7 天循環的晨間有氧
}

export const GOAL_TEMPLATES: Record<PlanGoal, GoalTemplate> = {
  cut: {
    label: '減脂', emoji: '🔥',
    targetLabel: '75.5–77.5 kg',
    calorieLabel: '1500–1800 大卡', proteinLabel: '120–140g', water: '2500–3000',
    starch1: '白飯半碗或地瓜1條', starch2: '半碗飯（不餓可省）',
    dayNote: '低鹽多喝水；體重看 7 天平均、不看單日',
    gymCycle: ['全身訓練', '推（胸肩三頭）', '休息／伸展', '拉（背二頭）', '腿＋核心', '腹部＋坡度快走30分', '休息'],
    cardioCycle: [
      { am: '慢跑', amMin: 40 }, { am: '快走', amMin: 45 }, { am: '快走', amMin: 60 },
      { am: '慢跑', amMin: 40 }, { am: '快走', amMin: 45 }, { am: '快走', amMin: 60 }, { am: '輕鬆走', amMin: 30 },
    ],
  },
  gain: {
    label: '增肌', emoji: '💪',
    targetLabel: '緩速增重（+0.25kg／週）',
    calorieLabel: '2400–2800 大卡（微幅盈餘）', proteinLabel: '150–170g', water: '2500–3000',
    starch1: '白飯1碗或地瓜1.5條', starch2: '1碗飯',
    dayNote: '漸進超負荷、吃到微幅熱量盈餘；有氧維持低量',
    gymCycle: ['推（胸肩三頭）', '拉（背二頭）', '腿＋核心', '休息', '推（胸肩三頭）', '拉（背二頭）', '休息'],
    cardioCycle: [
      { am: '快走', amMin: 20 }, { am: '快走', amMin: 20 }, { am: '快走', amMin: 25 },
      { am: '輕鬆走', amMin: 15 }, { am: '快走', amMin: 20 }, { am: '快走', amMin: 20 }, { am: '休息', amMin: 0 },
    ],
  },
  maintain: {
    label: '維持', emoji: '⚖️',
    targetLabel: '維持體重與體態',
    calorieLabel: '2000–2300 大卡（維持熱量）', proteinLabel: '120–140g', water: '2500–3000',
    starch1: '白飯大半碗或地瓜1條', starch2: '半碗飯',
    dayNote: '均衡飲食、維持肌肉量與活動量',
    gymCycle: ['全身訓練', '有氧快走', '推（胸肩三頭）', '休息', '拉（背二頭）', '有氧快走', '休息'],
    cardioCycle: [
      { am: '快走', amMin: 35 }, { am: '快走', amMin: 40 }, { am: '快走', amMin: 35 },
      { am: '輕鬆走', amMin: 20 }, { am: '快走', amMin: 35 }, { am: '快走', amMin: 40 }, { am: '輕鬆走', amMin: 25 },
    ],
  },
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Generate a plan from a goal template, start date and number of weeks. */
export function buildPlan(goal: PlanGoal, startDate: string, weeks = 4): TrainingPlan {
  const tpl = GOAL_TEMPLATES[goal]
  const total = Math.max(1, Math.round(weeks)) * 7
  const days: PlanDay[] = []
  for (let i = 0; i < total; i++) {
    const date = addDaysISO(startDate, i)
    const c = i % 7
    const gym = tpl.gymCycle[c]
    const cardio = tpl.cardioCycle[c]
    const isRest = gym.includes('休息')
    const isLeg = gym.includes('腿')
    days.push({
      date,
      am: cardio.am,
      amMin: cardio.amMin,
      gym,
      meal1: `${M1_PROTEIN[i % M1_PROTEIN.length]}＋青菜2碗＋${tpl.starch1}`,
      meal2: `${M2_PROTEIN[i % M2_PROTEIN.length]}＋青菜3碗＋${tpl.starch2}`,
      waterMl: tpl.water,
      note: isRest ? '恢復日：早點睡、熱量別爆' : isLeg ? '腿日：訓練前後水喝夠、留半碗飯' : tpl.dayNote,
      done: { am: false, meal1: false, gym: false, meal2: false },
    })
  }
  return {
    version: PLAN_VERSION,
    goal,
    weeks: Math.max(1, Math.round(weeks)),
    title: `${tpl.label}計畫`,
    startDate,
    endDate: addDaysISO(startDate, total - 1),
    targetLabel: tpl.targetLabel,
    calorieLabel: tpl.calorieLabel,
    proteinLabel: tpl.proteinLabel,
    days,
  }
}

/** Default plan: 減脂, starting 2026/7/2, 4 weeks. */
export function defaultFatLossPlan(): TrainingPlan {
  return buildPlan('cut', '2026-07-02', 4)
}

const WD = ['日', '一', '二', '三', '四', '五', '六']
/** Weekday letter (日一二三四五六) for a YYYY-MM-DD date. */
export function weekdayZh(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : WD[d.getDay()]
}

/** MM/DD label for a YYYY-MM-DD date. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** ISO week bucket used to group days into 第N週 sections. */
export function weekIndex(plan: TrainingPlan, iso: string): number {
  const start = new Date(`${plan.startDate}T00:00:00`).getTime()
  const cur = new Date(`${iso}T00:00:00`).getTime()
  const startDow = (new Date(`${plan.startDate}T00:00:00`).getDay() + 6) % 7 // Mon=0
  const days = Math.floor((cur - start) / 86_400_000)
  return Math.floor((days + startDow) / 7)
}
