<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UtensilsCrossed, Sparkles, Loader2, MapPin } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PhraseAudioButton from '@/components/travel/PhraseAudioButton.vue'
import { useTravelWallet } from '@/composables/useTravelWallet'
import { aiApi, type FoodSuggestion } from '@/api'

const { t } = useI18n()

// Active destination drives the recommendations and the "speak to vendor" language.
const { destination } = useTravelWallet()

const dishes = ref<FoodSuggestion[]>([])
const loading = ref(false)
const msg = ref('')

async function suggest() {
  if (loading.value) return
  loading.value = true
  msg.value = ''
  dishes.value = []
  try {
    const place = `${destination.value.country} ${destination.value.city}`
    const r = await aiApi.suggestFood({ place })
    dishes.value = r.dishes
    if (!r.dishes.length) msg.value = t('tv.food.empty')
  } catch {
    msg.value = t('tv.food.disabled')
  } finally {
    loading.value = false
  }
}

// Clear stale recommendations when the destination changes.
watch(destination, () => {
  dishes.value = []
  msg.value = ''
})

function mapUrl(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Food" :title="$t('tv.food.title')" :subtitle="$t('tv.food.subtitle')" />

    <SectionCard :title="$t('tv.food.title')" :icon="UtensilsCrossed">
      <template #action>
        <button class="btn-primary" :disabled="loading" @click="suggest">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Sparkles v-else class="h-4 w-4" />
          {{ $t('tv.food.button') }}
        </button>
      </template>

      <p v-if="msg" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{{ msg }}</p>

      <EmptyState
        v-else-if="!dishes.length && !loading"
        :icon="UtensilsCrossed"
        :title="$t('tv.food.emptyTitle')"
        :description="$t('tv.food.emptyDesc')"
      />

      <ul v-if="dishes.length" class="grid gap-3 sm:grid-cols-2">
        <li v-for="(d, i) in dishes" :key="i" class="rounded-xl border border-ink-200 p-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-ink-800">{{ d.name }}</p>
              <p v-if="d.nativeName" class="text-xs text-ink-500">{{ d.nativeName }}</p>
            </div>
            <span v-if="d.category" class="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {{ d.category }}
            </span>
          </div>
          <p v-if="d.reason" class="mt-1.5 text-xs text-ink-500">{{ d.reason }}</p>
          <div class="mt-2 flex items-center justify-between gap-2">
            <a
              v-if="d.where"
              :href="mapUrl(`${destination.city} ${d.where}`)"
              target="_blank"
              rel="noopener"
              class="inline-flex min-w-0 items-center gap-1 text-xs text-ink-400 hover:text-brand-600"
            >
              <MapPin class="h-3 w-3 shrink-0" />
              <span class="truncate">{{ d.where }}</span>
            </a>
            <span class="grow" />
            <PhraseAudioButton
              v-if="d.nativeName"
              :text="d.nativeName"
              :lang="destination.ttsLang"
              :slow="false"
            />
          </div>
        </li>
      </ul>
    </SectionCard>
  </div>
</template>
