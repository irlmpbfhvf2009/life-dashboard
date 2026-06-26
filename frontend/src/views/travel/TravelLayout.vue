<script setup lang="ts">
// Travel module shell. The destination (country + region) is picked ONCE here at
// the top — it's shared synced state, so every sub-page reacts to it. Below the
// picker sits the sub-nav, then the active page.
import TravelSubNav from '@/components/travel/TravelSubNav.vue'
import DestinationPicker from '@/components/travel/DestinationPicker.vue'
import { useTravelWallet } from '@/composables/useTravelWallet'

const { destination } = useTravelWallet()
</script>

<template>
  <div>
    <!-- Destination picker (country → region), shared across the whole module -->
    <div class="mb-5 rounded-2xl border border-ink-200 bg-surface p-4 shadow-sm">
      <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">{{ $t('tv.common.destination') }}</p>
      <DestinationPicker />
      <p class="mt-3 text-sm text-ink-500">
        {{ $t('tv.common.current') }}：<span class="font-medium text-ink-700">{{ destination.flag }} {{ destination.country }}・{{ destination.city }}</span>
        <span v-if="destination.blurb" class="text-ink-400"> — {{ destination.blurb }}</span>
      </p>
    </div>

    <TravelSubNav />
    <RouterView />
  </div>
</template>
