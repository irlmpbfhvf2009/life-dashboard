<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Droplets } from 'lucide-vue-next'

const props = defineProps<{ done: number; goal: number }>() // millilitres
defineEmits<{ add: [ml: number] }>()

const { t } = useI18n()
const percent = computed(() => (props.goal > 0 ? Math.min(100, Math.round((props.done / props.goal) * 100)) : 0))

const drinks = [
  { key: 'water', emoji: '💧', ml: 250 },
  { key: 'coffee', emoji: '☕', ml: 150 },
  { key: 'tea', emoji: '🍵', ml: 200 },
]
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-sky-500/10 text-sky-500"><Droplets class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">{{ t('health.water.title') }}</h3>
      </div>
      <span class="text-sm font-bold text-ink-900">
        {{ done.toLocaleString() }}<span class="text-xs font-medium text-ink-400">/{{ goal.toLocaleString() }} ml</span>
      </span>
    </header>

    <div class="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div class="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300" :style="{ width: percent + '%' }" />
    </div>

    <div class="mt-4 grid grid-cols-3 gap-2">
      <button v-for="d in drinks" :key="d.key"
        class="flex flex-col items-center gap-0.5 rounded-2xl border border-ink-200 bg-surface py-2 text-sm transition-colors hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10"
        @click="$emit('add', d.ml)">
        <span class="text-lg leading-none">{{ d.emoji }}</span>
        <span class="text-2xs text-ink-500">{{ t('health.water.' + d.key) }} +{{ d.ml }}</span>
      </button>
    </div>
  </section>
</template>
