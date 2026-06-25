<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2, MapPin, CalendarRange, ExternalLink } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import DestinationPicker from '@/components/travel/DestinationPicker.vue'
import { useItinerary } from '@/composables/useTravelWallet'

const itin = useItinerary()
const { destination } = itin

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

    <div class="mb-6">
      <DestinationPicker />
      <p class="mt-2 text-sm text-ink-500">{{ $t('tv.common.current') }}：{{ destination.flag }} {{ destination.country }}・{{ destination.city }}</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
      <!-- Add -->
      <SectionCard :title="$t('tv.itinerary.addTitle')" :icon="Plus" class="lg:col-span-2 self-start">
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

      <!-- Days -->
      <div class="space-y-6 lg:col-span-3">
        <EmptyState
          v-if="!itin.items.value.length"
          :icon="CalendarRange"
          :title="$t('tv.itinerary.emptyTitle')"
          :description="$t('tv.itinerary.emptyDesc')"
        />
        <SectionCard v-for="grp in itin.byDay.value" :key="grp.day" :title="$t('tv.itinerary.dayLabel', { n: grp.day })" :icon="CalendarRange">
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
