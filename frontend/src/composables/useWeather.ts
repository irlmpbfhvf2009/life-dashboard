// 7-day weather forecast for a destination via Open-Meteo (free, no key, CORS-
// friendly). Cached in-memory per destination for 30 minutes so navigating
// between pages doesn't refetch. Degrades silently to an error flag.

import { ref, watch, type Ref } from 'vue'
import type { Destination } from '@/data/destinations'

export interface DailyForecast {
  date: string // ISO yyyy-mm-dd
  code: number
  tMax: number
  tMin: number
  precip: number // max precipitation probability %
}

export interface WeatherData {
  tempNow: number | null
  codeNow: number | null
  daily: DailyForecast[]
  timezone: string
}

const cache = new Map<string, { data: WeatherData; at: number }>()
const TTL = 30 * 60_000

export function useWeather(destination: Ref<Destination>) {
  const data = ref<WeatherData | null>(null)
  const loading = ref(false)
  const error = ref(false)

  async function load() {
    const d = destination.value
    const cached = cache.get(d.id)
    if (cached && Date.now() - cached.at < TTL) {
      data.value = cached.data
      error.value = false
      return
    }
    loading.value = true
    error.value = false
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}` +
        '&current=temperature_2m,weather_code' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        '&timezone=auto&forecast_days=7'
      const res = await fetch(url)
      if (!res.ok) throw new Error('weather request failed')
      const j = await res.json()
      const times: string[] = j.daily?.time ?? []
      const daily: DailyForecast[] = times.map((date, i) => ({
        date,
        code: j.daily.weather_code[i],
        tMax: Math.round(j.daily.temperature_2m_max[i]),
        tMin: Math.round(j.daily.temperature_2m_min[i]),
        precip: j.daily.precipitation_probability_max?.[i] ?? 0,
      }))
      const w: WeatherData = {
        tempNow: j.current ? Math.round(j.current.temperature_2m) : null,
        codeNow: j.current?.weather_code ?? null,
        daily,
        timezone: j.timezone ?? d.timezone,
      }
      cache.set(d.id, { data: w, at: Date.now() })
      data.value = w
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  watch(destination, load, { immediate: true })

  return { data, loading, error, reload: load }
}
