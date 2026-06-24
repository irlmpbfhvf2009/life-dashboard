<script setup lang="ts">
import { ref, watch } from 'vue'
import { Eye, EyeOff, Check, BookmarkPlus, Lightbulb } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import DifficultyBadge from './DifficultyBadge.vue'
import MasteryProgressBadge from './MasteryProgressBadge.vue'
import { SCENARIO_LABELS } from '@/data/english'
import type { VocabularyItem } from '@/types/english'

const props = defineProps<{ item: VocabularyItem; mastered?: boolean }>()
const emit = defineEmits<{ master: [item: VocabularyItem]; addReview: [item: VocabularyItem] }>()

const revealed = ref(false)
// Collapse the answer again when navigating to a different card.
watch(() => props.item.id, () => (revealed.value = false))
</script>

<template>
  <div class="card p-6">
    <div class="mb-4 flex items-center justify-between">
      <span class="text-xs font-medium text-brand-600">{{ SCENARIO_LABELS[item.scenario] }}</span>
      <div class="flex items-center gap-1.5">
        <DifficultyBadge :level="item.difficulty" />
        <MasteryProgressBadge :status="mastered ? 'MASTERED' : item.mastery" />
      </div>
    </div>

    <!-- Word -->
    <div class="text-center">
      <div class="flex items-center justify-center gap-2">
        <h2 class="text-3xl font-bold tracking-tight text-ink-900">{{ item.word }}</h2>
        <AudioPlayButton :text="item.word" slow size="md" />
      </div>
      <p class="mt-1 text-sm text-ink-400">{{ item.pronunciation }} · {{ item.partOfSpeech }}</p>
    </div>

    <!-- Reveal toggle -->
    <button
      class="mx-auto mt-5 flex items-center gap-1.5 rounded-full border border-ink-200 px-4 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600"
      @click="revealed = !revealed"
    >
      <component :is="revealed ? EyeOff : Eye" class="h-4 w-4" />
      {{ revealed ? '收合' : '顯示解答' }}
    </button>

    <!-- Answer -->
    <Transition name="reveal">
      <div v-if="revealed" class="mt-5 space-y-4 border-t border-ink-100 pt-5">
        <p class="text-center text-lg font-semibold text-ink-800">{{ item.meaningZh }}</p>

        <div class="rounded-2xl bg-ink-50 p-4">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm leading-relaxed text-ink-700">{{ item.example }}</p>
            <AudioPlayButton :text="item.example" slow />
          </div>
        </div>

        <div class="flex items-start gap-2 text-xs text-ink-500">
          <Lightbulb class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>{{ item.usageNote }}</span>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <span v-for="t in item.tags" :key="t" class="badge badge-gray">#{{ t }}</span>
        </div>

        <div class="flex gap-2 pt-1">
          <button class="btn-primary btn-sm flex-1 justify-center gap-1.5" :disabled="mastered" @click="emit('master', item)">
            <Check class="h-3.5 w-3.5" /> {{ mastered ? '已掌握' : '我會了' }}
          </button>
          <button class="btn-secondary btn-sm flex-1 justify-center gap-1.5" @click="emit('addReview', item)">
            <BookmarkPlus class="h-3.5 w-3.5" /> 加入複習
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.reveal-enter-active, .reveal-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.reveal-enter-from, .reveal-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
