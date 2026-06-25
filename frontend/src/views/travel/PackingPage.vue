<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2, ListChecks, Sparkles } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import DestinationPicker from '@/components/travel/DestinationPicker.vue'
import { useTravelPacking } from '@/composables/useTravelWallet'

const packing = useTravelPacking()
const { destination } = packing

const newItem = ref('')
function addItem() {
  if (!newItem.value.trim()) return
  packing.add(newItem.value)
  newItem.value = ''
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Packing" :title="$t('tv.packing.title')" :subtitle="$t('tv.packing.subtitle')" />

    <div class="mb-6">
      <DestinationPicker />
      <p class="mt-2 text-sm text-ink-500">{{ $t('tv.common.current') }}：{{ destination.flag }} {{ destination.country }}</p>
    </div>

    <SectionCard :title="$t('tv.packing.list')" :icon="ListChecks">
      <template #action>
        <span class="text-sm text-ink-400">{{ packing.doneCount.value }} / {{ packing.items.value.length }}</span>
      </template>

      <!-- Add -->
      <form class="mb-4 flex gap-2" @submit.prevent="addItem">
        <input v-model="newItem" type="text" :placeholder="$t('tv.packing.placeholder')" class="input flex-1" />
        <button type="submit" class="btn-primary shrink-0" :disabled="!newItem.trim()">
          <Plus class="h-4 w-4" /> {{ $t('tv.packing.add') }}
        </button>
      </form>

      <EmptyState
        v-if="!packing.items.value.length"
        :title="$t('tv.packing.emptyTitle')"
        :description="$t('tv.packing.emptyDesc')"
      >
        <button class="btn-secondary mt-1" @click="packing.seedDefaults()">
          <Sparkles class="h-4 w-4" /> {{ $t('tv.packing.loadTemplate') }}
        </button>
      </EmptyState>

      <ul v-else class="divide-y divide-ink-100">
        <li v-for="it in packing.items.value" :key="it.id" class="flex items-center gap-3 py-2.5">
          <label class="flex flex-1 cursor-pointer items-center gap-3">
            <input type="checkbox" :checked="it.done" class="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500" @change="packing.toggle(it.id)" />
            <span class="text-sm" :class="it.done ? 'text-ink-400 line-through' : 'text-ink-800'">{{ it.label }}</span>
          </label>
          <button class="btn-icon h-8 w-8 text-ink-300 hover:text-rose-600" @click="packing.remove(it.id)">
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </ul>

      <div v-if="packing.doneCount.value" class="mt-4 flex justify-end">
        <button class="btn-ghost btn-sm text-ink-400" @click="packing.clearDone()">{{ $t('tv.packing.clearDone') }}</button>
      </div>
    </SectionCard>
  </div>
</template>
