// Turn a TrainingPlan into an iCalendar (.ics) file the user can import into
// Google / Apple / Outlook calendars. Times are fixed defaults in Asia/Taipei
// (see PLAN_TIMES): morning cardio, first meal, evening gym, second meal.

import { PLAN_TIMES, type TrainingPlan, type PlanDay } from '@/data/fatLossPlan'

function esc(s: string): string {
  // Data has no literal backslashes; \n tokens below become iCal line breaks.
  return s.replace(/,/g, '\\,').replace(/;/g, '\\;')
}

/** "06:30" + minutes → "0715" (24h, wraps at midnight — plans never do). */
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 60) % 24)}${pad(total % 60)}`
}

const compact = (hhmm: string) => hhmm.replace(':', '')
const dt = (iso: string, hhmm: string) => `${iso.replace(/-/g, '')}T${hhmm}00`

let uidSeq = 0
function vevent(iso: string, start: string, end: string, summary: string, desc: string): string[] {
  uidSeq += 1
  return [
    'BEGIN:VEVENT',
    `UID:fatloss-${iso}-${uidSeq}@life-dashboard`,
    'DTSTAMP:20260101T000000Z',
    `DTSTART;TZID=Asia/Taipei:${dt(iso, start)}`,
    `DTEND;TZID=Asia/Taipei:${dt(iso, end)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(desc)}`,
    'END:VEVENT',
  ]
}

function dayEvents(d: PlanDay): string[] {
  const out: string[] = []
  // Rest days (amMin 0) get no morning-cardio event.
  if (d.amMin > 0) {
    out.push(...vevent(d.date, compact(PLAN_TIMES.am), addMinutes(PLAN_TIMES.am, d.amMin),
      `🏃 晨間有氧・${d.am} ${d.amMin}分`,
      `${d.am} ${d.amMin} 分鐘\\n注意：${d.note}`))
  }
  out.push(...vevent(d.date, compact(PLAN_TIMES.meal1), addMinutes(PLAN_TIMES.meal1, 40),
    '🍱 第一餐', `${d.meal1}\\n目標：蛋白質約60–70g`))
  out.push(...vevent(d.date, compact(PLAN_TIMES.gym), addMinutes(PLAN_TIMES.gym, 60),
    `🏋️ 晚間健身・${d.gym}`, `${d.gym}\\n提醒：${d.note}`))
  out.push(...vevent(d.date, compact(PLAN_TIMES.meal2), addMinutes(PLAN_TIMES.meal2, 40),
    '🍽️ 第二餐（20:00前吃完）', `${d.meal2}\\n目標：每日蛋白120–140g、每日喝水${d.waterMl}ml`))
  return out
}

/** Serialize the plan to an iCalendar string. */
export function planToIcs(plan: TrainingPlan): string {
  uidSeq = 0
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//life-dashboard//fatloss-plan//ZH-TW',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(plan.title)}`,
    'X-WR-TIMEZONE:Asia/Taipei',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Taipei',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
  for (const d of plan.days) lines.push(...dayEvents(d))
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/** Trigger a browser download of the plan as a .ics file. */
export function downloadIcs(plan: TrainingPlan): void {
  const blob = new Blob([planToIcs(plan)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${plan.title.replace(/[\\/:*?"<>|]/g, '_')}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
