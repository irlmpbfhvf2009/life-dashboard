<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, MapPin, CalendarRange, ExternalLink, Sparkles, Loader2, PlusCircle } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useItinerary, useTravelWallet } from '@/composables/useTravelWallet'
import { useWeather, type DailyForecast } from '@/composables/useWeather'
import { weatherInfo } from '@/utils/weather'
import { aiApi, type SpotSuggestion } from '@/api'

const { t } = useI18n()
const itin = useItinerary()
const { destination } = itin
const { departDate } = useTravelWallet()
const { data: weather } = useWeather(destination)

// ---- AI spot suggestions ----
const suggestDays = ref(3)
const spots = ref<SpotSuggestion[]>([])
const suggesting = ref(false)
const spotsMsg = ref('')

async function suggest() {
  if (suggesting.value) return
  suggesting.value = true
  spotsMsg.value = ''
  spots.value = []
  try {
    const place = `${destination.value.country} ${destination.value.city}`
    const r = await aiApi.suggestSpots({ place, days: Number(suggestDays.value) || 3 })
    spots.value = r.spots
    if (!r.spots.length) spotsMsg.value = t('tv.spots.empty')
  } catch {
    spotsMsg.value = t('tv.spots.disabled')
  } finally {
    suggesting.value = false
  }
}
function addSpot(s: SpotSuggestion) {
  itin.add({ day: s.day, time: '', place: s.name, note: s.reason })
  spots.value = spots.value.filter((x) => x !== s)
}

// Map each itinerary day-number to its forecast (departure date + N-1 days),
// when a departure date is set and the day falls within the 7-day forecast.
const dayWeather = computed(() => {
  const map: Record<number, DailyForecast> = {}
  if (!departDate.value || !weather.value) return map
  for (const grp of itin.byDay.value) {
    const d = new Date(`${departDate.value}T00:00:00`)
    d.setDate(d.getDate() + (grp.day - 1))
    const iso = d.toISOString().slice(0, 10)
    const f = weather.value.daily.find((x) => x.date === iso)
    if (f) map[grp.day] = f
  }
  return map
})

const form = ref({ day: 1, time: '', place: '', note: '' })
function submit() {
  if (!form.value.place.trim()) return
  itin.add({ day: Number(form.value.day) || 1, time: form.value.time, place: form.value.place, note: form.value.note })
  form.value = { day: form.value.day, time: '', place: '', note: '' }
}

function mapUrl(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Itinerary" :title="$t('tv.itinerary.title')" :subtitle="$t('tv.itinerary.subtitle')" />

    <div class="grid gap-6 lg:grid-cols-5">
      <!-- Add + AI suggest -->
      <div class="space-y-6 lg:col-span-2 self-start">
      <SectionCard :title="$t('tv.itinerary.addTitle')" :icon="Plus">
        <form class="space-y-3" @submit.prevent="submit">
          <div class="flex gap-3">
            <div class="w-24">
              <label class="label">{{ $t('tv.itinerary.day') }}</label>
              <input v-model.number="form.day" type="number" min="1" class="input" />
            </div>
            <div class="flex-1">
              <label class="label">{{ $t('tv.itinerary.time') }}</label>
              <input v-model="form.time" type="text" placeholder="09:00" class="input" />
            </div>
          </div>
          <div>
            <label class="label">{{ $t('tv.itinerary.place') }}</label>
            <input v-model="form.place" type="text" :placeholder="$t('tv.itinerary.placePlaceholder')" class="input" />
          </div>
          <div>
            <label class="label">{{ $t('tv.itinerary.note') }}</label>
            <input v-model="form.note" type="text" :placeholder="$t('tv.itinerary.notePlaceholder')" class="input" />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="!form.place.trim()">
            <Plus class="h-4 w-4" /> {{ $t('tv.itinerary.addBtn') }}
          </button>
        </form>
      </SectionCard>

      <!-- AI spot suggestions -->
      <SectionCard :title="$t('tv.spots.title')" :icon="Sparkles">
        <div class="flex items-end gap-2">
          <div class="w-28">
            <label class="label">{{ $t('tv.spots.days') }}</label>
            <input v-model.number="suggestDays" type="number" min="1" max="14" class="input" />
          </div>
          <button class="btn-primary flex-1" :disabled="suggesting" @click="suggest">
            <Loader2 v-if="suggesting" class="h-4 w-4 animate-spin" />
            <Sparkles v-else class="h-4 w-4" />
            {{ $t('tv.spots.button') }}
          </button>
        </div>
        <p v-if="spotsMsg" class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{{ spotsMsg }}</p>
        <ul v-if="spots.length" class="mt-3 space-y-2">
          <li v-for="(s, i) in spots" :key="i" class="rounded-xl border border-ink-200 p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-ink-800">
                  <span class="mr-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">{{ $t('tv.itinerary.dayLabel', { n: s.day }) }}</span>
                  {{ s.name }}
                </p>
                <p v-if="s.area" class="text-xs text-ink-400">{{ s.area }}</p>
                <p v-if="s.reason" class="mt-0.5 text-xs text-ink-500">{{ s.reason }}</p>
              </div>
              <button class="btn-icon h-8 w-8 shrink-0 text-brand-500 hover:bg-brand-50" :title="$t('tv.spots.add')" @click="addSpot(s)">
                <PlusCircle class="h-5 w-5" />
              </button>
            </div>
          </li>
        </ul>
      </SectionCard>
      </div>

      <!-- Days -->
      <div class="space-y-6 lg:col-span-3">
        <EmptyState
          v-if="!itin.items.value.length"
          :icon="CalendarRange"
          :title="$t('tv.itinerary.emptyTitle')"
          :description="$t('tv.itinerary.emptyDesc')"
        />
        <SectionCard v-for="grp in itin.byDay.value" :key="grp.day" :title="$t('tv.itinerary.dayLabel', { n: grp.day })" :icon="CalendarRange">
          <template v-if="dayWeather[grp.day]" #action>
            <span class="inline-flex items-center gap-1 text-xs text-ink-500">
              {{ weatherInfo(dayWeather[grp.day].code).icon }}
              {{ dayWeather[grp.day].tMax }}° / {{ dayWeather[grp.day].tMin }}°
              <span v-if="dayWeather[grp.day].precip >= 30" class="text-sky-500">· {{ dayWeather[grp.day].precip }}%</span>
            </span>
          </template>
          <ul class="divide-y divide-ink-100">
            <li v-for="it in grp.list" :key="it.id" class="flex items-start justify-between gap-3 py-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span v-if="it.time" class="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{{ it.time }}</span>
                  <a :href="mapUrl(it.place)" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm font-semibold text-ink-800 hover:text-brand-600">
                    <MapPin class="h-3.5 w-3.5 shrink-0 text-ink-400" />
                    {{ it.place }}
                    <ExternalLink class="h-3 w-3 text-ink-300" />
                  </a>
                </div>
                <p v-if="it.note" class="mt-0.5 pl-5 text-xs text-ink-500">{{ it.note }}</p>
              </div>
              <button class="btn-icon h-8 w-8 shrink-0 text-ink-300 hover:text-rose-600" @click="itin.remove(it.id)">
                <Trash2 class="h-4 w-4" />
              </button>
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  </div>
</template>
