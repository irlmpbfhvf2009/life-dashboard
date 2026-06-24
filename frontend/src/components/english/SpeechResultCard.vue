<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SentenceComparison } from '@/utils/pronunciation'

const { t } = useI18n()

const props = defineProps<{
  target: string
  spoken: string
  comparison: SentenceComparison
}>()

// Tokenize the target and mark which words were matched vs missed, for inline
// highlighting (matched = normal, missed = amber underline).
const tokens = computed(() => {
  const missing = new Set(props.comparison.missingWords)
  return props.target.split(/(\s+)/).map((chunk) => {
    const word = chunk.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')
    if (!word.trim()) return { text: chunk, miss: false, space: true }
    return { text: chunk, miss: missing.has(word), space: false }
  })
})
</script>

<template>
  <div class="space-y-3">
    <div>
      <p class="mb-1 text-xs font-medium text-ink-400">{{ t('ec.speaking.target') }}</p>
      <p class="text-base leading-relaxed text-ink-800">
        <template v-for="(tk, i) in tokens" :key="i"><span
          v-if="!tk.space"
          :class="tk.miss ? 'rounded bg-amber-100 px-0.5 text-amber-700 underline decoration-amber-400 decoration-wavy dark:bg-amber-500/15 dark:text-amber-300' : ''"
        >{{ tk.text }}</span><template v-else>{{ tk.text }}</template></template>
      </p>
    </div>
    <div>
      <p class="mb-1 text-xs font-medium text-ink-400">{{ t('ec.speaking.youSaid') }}</p>
      <p class="text-sm leading-relaxed text-ink-600">{{ spoken || '—' }}</p>
    </div>
    <p v-if="comparison.missingWords.length" class="text-xs text-ink-400">
      {{ t('ec.speaking.missed') }}<span class="font-medium text-amber-600">{{ comparison.missingWords.join('、') }}</span>
    </p>
  </div>
</template>
