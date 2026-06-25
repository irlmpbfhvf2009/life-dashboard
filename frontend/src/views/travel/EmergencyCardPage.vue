<script setup lang="ts">
import { computed } from 'vue'
import {
  Siren, Phone, Hotel, ShieldCheck, Landmark, Hash, Droplet, NotebookPen,
  WifiOff, PhoneCall, Megaphone,
} from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import DestinationPicker from '@/components/travel/DestinationPicker.vue'
import PhraseAudioButton from '@/components/travel/PhraseAudioButton.vue'
import { useTripInfo, type TripInfo } from '@/composables/useTravelWallet'

const { destination, info, update } = useTripInfo()

// The local emergency-numbers line lives in the destination cheat sheet (Phone icon).
const emergency = computed(() => destination.value.cheatSheet.find((c) => c.icon === Phone))

// Key help phrases (Chinese + native script + pronunciation) — same data the
// phrasebook uses, filtered to the emergency category.
const helpPhrases = computed(
  () => destination.value.categories.find((c) => c.key === 'emergency')?.items ?? [],
)

const ttsLang = computed(() => destination.value.ttsLang)

// Writable per-field binding that writes straight through to synced state.
function field(key: keyof TripInfo) {
  return computed<string>({
    get: () => info.value[key],
    set: (v: string) => update({ [key]: v } as Partial<TripInfo>),
  })
}
const hotelName = field('hotelName')
const hotelAddress = field('hotelAddress')
const bookingRef = field('bookingRef')
const insurer = field('insurer')
const insurancePhone = field('insurancePhone')
const embassy = field('embassy')
const bloodType = field('bloodType')
const notes = field('notes')

function telHref(raw: string) {
  const num = raw.replace(/[^\d+]/g, '')
  return num ? `tel:${num}` : undefined
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Emergency" :title="$t('tv.emergency.title')" :subtitle="$t('tv.emergency.subtitle')" />

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <DestinationPicker />
      <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <WifiOff class="h-3.5 w-3.5" /> {{ $t('tv.emergency.offlineReady') }}
      </span>
    </div>

    <!-- Emergency numbers — the loud, always-visible block -->
    <div class="mb-6 overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-500 to-red-600 p-6 text-white">
      <div class="flex items-center gap-2 text-white/85">
        <Siren class="h-5 w-5" />
        <span class="text-sm font-semibold">{{ $t('tv.emergency.localNumbers') }}・{{ destination.flag }} {{ destination.country }}</span>
      </div>
      <p class="mt-2 text-2xl font-bold leading-snug tracking-tight">{{ emergency?.value }}</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- My trip info (editable) -->
      <div class="space-y-6">
        <SectionCard :title="$t('tv.emergency.myTrip')" :icon="Hotel">
          <p class="mb-3 text-sm text-ink-500">{{ $t('tv.emergency.myTripHint') }}</p>
          <div class="space-y-3">
            <div>
              <label class="label inline-flex items-center gap-1.5"><Hotel class="h-3.5 w-3.5 text-ink-400" />{{ $t('tv.emergency.hotelName') }}</label>
              <input v-model="hotelName" type="text" class="input" :placeholder="$t('tv.emergency.hotelNamePh')" />
            </div>
            <div>
              <label class="label inline-flex items-center gap-1.5"><PhraseAudioButton v-if="hotelAddress" :text="hotelAddress" :lang="ttsLang" :slow="false" />{{ $t('tv.emergency.hotelAddress') }}</label>
              <textarea v-model="hotelAddress" rows="2" class="input resize-none" :placeholder="$t('tv.emergency.hotelAddressPh')" />
              <p class="mt-1 text-xs text-ink-400">{{ $t('tv.emergency.hotelAddressTip') }}</p>
            </div>
            <div>
              <label class="label inline-flex items-center gap-1.5"><Hash class="h-3.5 w-3.5 text-ink-400" />{{ $t('tv.emergency.bookingRef') }}</label>
              <input v-model="bookingRef" type="text" class="input" :placeholder="$t('tv.emergency.bookingRefPh')" />
            </div>
          </div>
        </SectionCard>

        <SectionCard :title="$t('tv.emergency.contacts')" :icon="ShieldCheck">
          <div class="space-y-3">
            <div>
              <label class="label inline-flex items-center gap-1.5"><ShieldCheck class="h-3.5 w-3.5 text-ink-400" />{{ $t('tv.emergency.insurer') }}</label>
              <input v-model="insurer" type="text" class="input" :placeholder="$t('tv.emergency.insurerPh')" />
            </div>
            <div>
              <label class="label inline-flex items-center gap-1.5"><PhoneCall class="h-3.5 w-3.5 text-ink-400" />{{ $t('tv.emergency.insurancePhone') }}</label>
              <div class="flex gap-2">
                <input v-model="insurancePhone" type="tel" class="input flex-1" :placeholder="$t('tv.emergency.phonePh')" />
                <a v-if="telHref(insurancePhone)" :href="telHref(insurancePhone)" class="btn-secondary !h-10 shrink-0 !px-3"><Phone class="h-4 w-4" /></a>
              </div>
            </div>
            <div>
              <label class="label inline-flex items-center gap-1.5"><Landmark class="h-3.5 w-3.5 text-ink-400" />{{ $t('tv.emergency.embassy') }}</label>
              <div class="flex gap-2">
                <input v-model="embassy" type="text" class="input flex-1" :placeholder="$t('tv.emergency.embassyPh')" />
                <a v-if="telHref(embassy)" :href="telHref(embassy)" class="btn-secondary !h-10 shrink-0 !px-3"><Phone class="h-4 w-4" /></a>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label inline-flex items-center gap-1.5"><Droplet class="h-3.5 w-3.5 text-ink-400" />{{ $t('tv.emergency.bloodType') }}</label>
                <input v-model="bloodType" type="text" class="input" placeholder="O / A / B / AB" />
              </div>
            </div>
            <div>
              <label class="label inline-flex items-center gap-1.5"><NotebookPen class="h-3.5 w-3.5 text-ink-400" />{{ $t('tv.emergency.notes') }}</label>
              <textarea v-model="notes" rows="2" class="input resize-none" :placeholder="$t('tv.emergency.notesPh')" />
            </div>
          </div>
        </SectionCard>
      </div>

      <!-- Show-to-locals: hotel address + key help phrases, big + speakable -->
      <div class="space-y-6">
        <SectionCard v-if="hotelAddress" :title="$t('tv.emergency.showDriver')" :icon="Megaphone">
          <div class="rounded-xl border border-ink-200 bg-ink-50 p-4">
            <p class="text-lg font-semibold leading-relaxed text-ink-800">{{ hotelAddress }}</p>
            <div class="mt-3">
              <PhraseAudioButton :text="hotelAddress" :lang="ttsLang" size="md" />
            </div>
          </div>
          <p class="mt-2 text-xs text-ink-400">{{ $t('tv.emergency.showDriverTip') }}</p>
        </SectionCard>

        <SectionCard :title="$t('tv.emergency.helpPhrases')" :icon="Megaphone">
          <ul class="space-y-3">
            <li v-for="(p, i) in helpPhrases" :key="i" class="rounded-xl border border-ink-200 p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm text-ink-500">{{ p.zh }}</p>
                  <p class="mt-0.5 text-lg font-semibold text-ink-800">{{ p.native }}</p>
                  <p class="text-xs text-ink-400">{{ p.pron }}</p>
                </div>
                <PhraseAudioButton :text="p.native" :lang="ttsLang" class="shrink-0" />
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  </div>
</template>
