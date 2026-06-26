<script setup lang="ts">
// Two-level destination selector for the travel module: pick a country, then a
// region (popular area / county). Writes to the shared (synced) trip state, so
// every page reacts and the choice follows the user across devices.
import { computed } from 'vue'
import { useTravelWallet } from '@/composables/useTravelWallet'
import { destinationGroups, type CountryGroup } from '@/data/destinations'

const { destination, destinationId } = useTravelWallet()

const activeGroup = computed<CountryGroup>(
  () =>
    destinationGroups.find((g) => g.countryId === destination.value.countryId) ??
    destinationGroups[0],
)

// Selecting a country keeps the current region if it already belongs to it,
// otherwise jumps to that country's primary (first) region.
function pickCountry(g: CountryGroup) {
  if (g.countryId !== destination.value.countryId) destinationId.value = g.regions[0].id
}
</script>

<template>
  <div class="space-y-3">
    <!-- Country row -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="g in destinationGroups"
        :key="g.countryId"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors"
        :class="g.countryId === activeGroup.countryId
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-ink-200 text-ink-500 hover:bg-ink-100'"
        @click="pickCountry(g)"
      >
        <span>{{ g.flag }}</span> {{ g.country }}
      </button>
    </div>

    <!-- Region row (only when the active country has more than one region) -->
    <div v-if="activeGroup.regions.length > 1" class="flex flex-wrap gap-2 border-t border-ink-100 pt-3">
      <button
        v-for="r in activeGroup.regions"
        :key="r.id"
        type="button"
        class="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
        :class="destinationId === r.id
          ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300'
          : 'border-ink-200 text-ink-500 hover:bg-ink-100'"
        @click="destinationId = r.id"
      >
        {{ r.city }}
      </button>
    </div>
  </div>
</template>
