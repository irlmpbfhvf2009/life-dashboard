<script setup lang="ts">
// Country selector for the travel module. Writes to the shared (synced) trip
// state, so every page reacts and the choice follows the user across devices.
import { useTravelWallet } from '@/composables/useTravelWallet'

const { destinations, destinationId } = useTravelWallet()
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="d in destinations"
      :key="d.id"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors"
      :class="destinationId === d.id
        ? 'border-brand-500 bg-brand-500 text-white'
        : 'border-ink-200 text-ink-500 hover:bg-ink-100'"
      @click="destinationId = d.id"
    >
      <span>{{ d.flag }}</span> {{ d.country }}
    </button>
  </div>
</template>
