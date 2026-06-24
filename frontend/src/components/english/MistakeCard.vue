<script setup lang="ts">
import { ArrowRight, Repeat, Check } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import MasteryProgressBadge from './MasteryProgressBadge.vue'
import { MISTAKE_LABELS } from '@/data/english'
import { formatDate } from '@/utils/format'
import type { EnglishMistake } from '@/types/english'

defineProps<{ mistake: EnglishMistake; queued?: boolean }>()
defineEmits<{ review: [mistake: EnglishMistake] }>()
</script>

<template>
  <div class="card p-4">
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="badge badge-amber">{{ MISTAKE_LABELS[mistake.category] }}</span>
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-ink-400">× {{ mistake.frequency }}</span>
        <MasteryProgressBadge :status="mistake.mastery" />
      </div>
    </div>

    <p class="text-sm text-ink-500 line-through decoration-rose-300">{{ mistake.original }}</p>
    <div class="my-1 text-ink-300"><ArrowRight class="h-3.5 w-3.5" /></div>
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm font-semibold text-ink-900">{{ mistake.corrected }}</p>
      <AudioPlayButton :text="mistake.corrected" slow />
    </div>

    <p v-if="mistake.note" class="mt-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs text-ink-500">{{ mistake.note }}</p>

    <div class="mt-3 flex items-center justify-between">
      <span class="text-xs text-ink-400">最近 {{ formatDate(mistake.lastSeen) }}</span>
      <button
        class="btn-secondary btn-sm gap-1.5" :disabled="queued"
        @click="$emit('review', mistake)"
      >
        <Check v-if="queued" class="h-3.5 w-3.5 text-emerald-500" />
        <Repeat v-else class="h-3.5 w-3.5" />
        {{ queued ? '複習佇列中' : '加入複習' }}
      </button>
    </div>
  </div>
</template>
