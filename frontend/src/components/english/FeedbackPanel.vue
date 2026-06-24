<script setup lang="ts">
import { AlertTriangle, Sparkles, BookText, BookmarkPlus, Lightbulb, Check } from 'lucide-vue-next'
import ScoreRing from './ScoreRing.vue'
import type { TurnFeedback } from '@/types/english'

defineProps<{ feedback: TurnFeedback | null; added?: boolean }>()
defineEmits<{ addReview: [] }>()
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <Lightbulb class="h-4 w-4 text-brand-500" />
      <h3 class="section-title">即時回饋</h3>
    </div>

    <p v-if="!feedback" class="rounded-xl bg-ink-50 px-3 py-6 text-center text-xs text-ink-400">
      送出一句英文後，這裡會顯示文法、自然度與句型分析。
    </p>

    <template v-else>
      <!-- Pattern score -->
      <div class="flex items-center gap-4 rounded-xl border border-ink-100 p-3">
        <ScoreRing :value="feedback.patternScore" :size="72" :stroke="7" suffix="" />
        <div>
          <p class="text-sm font-semibold text-ink-800">句型分數</p>
          <p class="text-xs text-ink-400">綜合文法與自然度</p>
        </div>
      </div>

      <!-- Grammar issues -->
      <section v-if="feedback.grammarIssues.length">
        <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
          <AlertTriangle class="h-3.5 w-3.5" /> 文法提醒
        </p>
        <ul class="space-y-1">
          <li v-for="(g, i) in feedback.grammarIssues" :key="i" class="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{{ g }}</li>
        </ul>
      </section>

      <!-- More natural -->
      <section v-if="feedback.natural">
        <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-600">
          <Sparkles class="h-3.5 w-3.5" /> 更自然的說法
        </p>
        <p class="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{{ feedback.natural }}</p>
      </section>

      <!-- Vocab suggestions -->
      <section v-if="feedback.vocabSuggestions.length">
        <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
          <BookText class="h-3.5 w-3.5" /> 單字建議
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="w in feedback.vocabSuggestions" :key="w" class="badge badge-gray">{{ w }}</span>
        </div>
      </section>

      <!-- Focus note -->
      <p v-if="feedback.focusNote" class="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">{{ feedback.focusNote }}</p>

      <!-- Add to review -->
      <button
        v-if="feedback.correctable"
        class="btn-secondary btn-sm w-full justify-center gap-1.5"
        :disabled="added"
        @click="$emit('addReview')"
      >
        <Check v-if="added" class="h-3.5 w-3.5 text-emerald-500" />
        <BookmarkPlus v-else class="h-3.5 w-3.5" />
        {{ added ? '已加入複習' : '把這個錯誤加入複習' }}
      </button>
    </template>
  </div>
</template>
