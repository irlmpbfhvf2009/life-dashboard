// Live local time at a destination + the hour difference from Taiwan, computed
// purely from IANA timezones via Intl (no library). Ticks every 30s.

import { onUnmounted, ref, watch, type Ref } from 'vue'
import type { Destination } from '@/data/destinations'

const HOME_TZ = 'Asia/Taipei'

/** UTC offset (minutes) of an IANA timezone at a given instant. */
function offsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at)
  const m: Record<string, string> = {}
  for (const p of parts) m[p.type] = p.value
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second)
  return Math.round((asUTC - at.getTime()) / 60_000)
}

export function useLocalTime(destination: Ref<Destination>) {
  const time = ref('')
  const diffHours = ref(0)
  let timer: ReturnType<typeof setInterval> | undefined

  function tick() {
    const now = new Date()
    time.value = new Intl.DateTimeFormat('en-GB', {
      timeZone: destination.value.timezone, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now)
    diffHours.value = Math.round(
      (offsetMinutes(destination.value.timezone, now) - offsetMinutes(HOME_TZ, now)) / 60,
    )
  }

  watch(destination, tick, { immediate: true })
  timer = setInterval(tick, 30_000)
  onUnmounted(() => { if (timer) clearInterval(timer) })

  return { time, diffHours }
}
