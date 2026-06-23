<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Repeat, Flame, Check } from 'lucide-vue-next'
import type { HabitLog } from '@/data/health'

const props = defineProps<{ items: HabitLog[]; weekRate: number }>()
defineEmits<{ toggle: [id: number] }>()

const { t } = useI18n()

const done = computed(() => props.items.filter((h) => h.done).length)
const allDone = computed(() => done.value === props.items.length && props.items.length > 0)
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-brand-500/10 text-brand-500"><Repeat class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">{{ t('health.habits.title') }}</h3>
      </div>
      <span class="text-xs text-ink-400">
        {{ t('health.habits.weekRate') }} <span class="font-semibold text-ink-600">{{ weekRate }}%</span>
      </span>
    </header>

    <p class="mb-3 text-sm font-medium text-ink-500">
      {{ t('health.habits.progress', { done, total: items.length }) }}
    </p>

    <ul class="space-y-1.5">
      <li v-for="h in items" :key="h.id">
        <button
          class="flex w-full items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-ink-50"
          @click="$emit('toggle', h.id)"
        >
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 transition-colors"
            :class="h.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-200 text-transparent'"
          >
            <Check class="h-4 w-4" :stroke-width="3" />
          </span>
          <span class="text-lg leading-none">{{ h.emoji }}</span>
          <span class="min-w-0 flex-1 truncate text-sm" :class="h.done ? 'text-ink-400 line-through' : 'text-ink-800'">
            {{ t('health.habitNames.' + h.key) }}
          </span>
          <span class="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Flame class="h-3.5 w-3.5" /> {{ h.streak }}
          </span>
        </button>
      </li>
    </ul>

    <Transition name="fade">
      <p v-if="allDone" class="mt-3 rounded-2xl bg-emerald-500/10 px-3.5 py-2.5 text-center text-sm font-medium text-emerald-600 dark:text-emerald-300">
        {{ t('health.habits.allDone') }}
      </p>
    </Transition>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
