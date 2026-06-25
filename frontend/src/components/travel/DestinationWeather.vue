<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloudOff, Loader2, Umbrella } from 'lucide-vue-next'
import { useTravelWallet } from '@/composables/useTravelWallet'
import { useWeather } from '@/composables/useWeather'
import { useLocalTime } from '@/composables/useLocalTime'
import { weatherInfo } from '@/utils/weather'

const { t, locale } = useI18n()
const { destination } = useTravelWallet()
const { data, loading, error } = useWeather(destination)
const { time, diffHours } = useLocalTime(destination)

const nowInfo = computed(() => (data.value?.codeNow != null ? weatherInfo(data.value.codeNow) : null))

function weekday(dateISO: string, idx: number) {
  if (idx === 0) return t('tv.weather.today')
  return new Intl.DateTimeFormat(locale.value, { weekday: 'short' }).format(new Date(`${dateISO}T00:00:00`))
}

const diffText = computed(() => {
  const h = diffHours.value
  if (h === 0) return t('tv.time.same')
  return h > 0 ? t('tv.time.diffAhead', { n: h }) : t('tv.time.diffBehind', { n: -h })
})

// Most of the forecast is wet → show a rainy-season heads-up.
const rainy = computed(() => {
  const days = data.value?.daily ?? []
  return days.length >= 4 && days.filter((d) => d.precip >= 60).length >= Math.ceil(days.length * 0.6)
})
</script>

<template>
  <div class="card p-5">
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3">
        <span v-if="nowInfo" class="text-3xl leading-none">{{ nowInfo.icon }}</span>
        <div>
          <p class="text-sm font-medium text-ink-500">{{ destination.flag }} {{ destination.city }}</p>
          <p v-if="data && data.tempNow != null" class="text-2xl font-bold tracking-tight text-ink-900">
            {{ data.tempNow }}°C
            <span v-if="nowInfo" class="ml-1 text-sm font-normal text-ink-500">{{ t('tv.weather.cond.' + nowInfo.key) }}</span>
          </p>
          <p v-else-if="loading" class="mt-1 text-sm text-ink-400">···</p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-sm font-medium text-ink-500">{{ t('tv.time.title') }}</p>
        <p class="text-2xl font-bold tabular-nums tracking-tight text-ink-900">{{ time }}</p>
        <p class="text-xs text-ink-400">{{ diffText }}</p>
      </div>
    </div>

    <div v-if="loading && !data" class="mt-4 flex items-center gap-2 text-sm text-ink-400">
      <Loader2 class="h-4 w-4 animate-spin" /> {{ t('tv.weather.title') }}…
    </div>
    <p v-else-if="error && !data" class="mt-4 flex items-center gap-1.5 text-sm text-ink-400">
      <CloudOff class="h-4 w-4" /> {{ t('tv.weather.unavailable') }}
    </p>

    <!-- 7-day forecast strip -->
    <div v-if="data && data.daily.length" class="mt-4 grid grid-cols-7 gap-1 border-t border-ink-100 pt-4">
      <div v-for="(d, i) in data.daily" :key="d.date" class="flex flex-col items-center gap-0.5 text-center">
        <span class="text-[11px] text-ink-400">{{ weekday(d.date, i) }}</span>
        <span class="text-lg leading-none">{{ weatherInfo(d.code).icon }}</span>
        <span class="text-xs font-semibold text-ink-800">{{ d.tMax }}°</span>
        <span class="text-[11px] text-ink-400">{{ d.tMin }}°</span>
        <span v-if="d.precip >= 30" class="text-[10px] font-medium text-sky-500">{{ d.precip }}%</span>
      </div>
    </div>

    <p v-if="rainy" class="mt-3 flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
      <Umbrella class="h-3.5 w-3.5 shrink-0" /> {{ t('tv.weather.rainyHint') }}
    </p>
  </div>
</template>
