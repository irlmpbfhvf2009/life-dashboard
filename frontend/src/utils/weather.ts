// Map a WMO weather code (from Open-Meteo) to an emoji + an i18n condition key
// (tv.weather.cond.*). Codes are bucketed into a small, friendly set.

export interface WeatherCondition {
  icon: string
  key: string
}

export function weatherInfo(code: number): WeatherCondition {
  if (code === 0) return { icon: '☀️', key: 'clear' }
  if (code === 1 || code === 2) return { icon: '⛅', key: 'partlyCloudy' }
  if (code === 3) return { icon: '☁️', key: 'cloudy' }
  if (code === 45 || code === 48) return { icon: '🌫️', key: 'fog' }
  if (code >= 51 && code <= 57) return { icon: '🌦️', key: 'drizzle' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', key: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '🌨️', key: 'snow' }
  if (code >= 95) return { icon: '⛈️', key: 'thunder' }
  return { icon: '☁️', key: 'cloudy' }
}
