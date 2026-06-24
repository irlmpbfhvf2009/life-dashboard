<script setup lang="ts">
import { ArrowRight, Sparkles, AlertTriangle, Repeat } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import type { EnglishCorrection } from '@/types/english'

defineProps<{ correction: EnglishCorrection }>()
</script>

<template>
  <div class="space-y-4">
    <!-- Original → Corrected -->
    <div class="rounded-2xl border border-ink-100 p-4">
      <p class="mb-1 text-xs font-medium text-ink-400">原句</p>
      <p class="text-sm text-ink-500 line-through decoration-rose-300">{{ correction.original }}</p>
      <div class="my-2 flex items-center gap-2 text-ink-300"><ArrowRight class="h-4 w-4" /></div>
      <p class="mb-1 text-xs font-medium text-emerald-600">修正版</p>
      <div class="flex items-start justify-between gap-2">
        <p class="text-base font-semibold leading-relaxed text-ink-900">{{ correction.corrected }}</p>
        <AudioPlayButton :text="correction.corrected" slow />
      </div>
    </div>

    <!-- More natural -->
    <div v-if="correction.natural && correction.natural !== correction.corrected" class="rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10">
      <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-300">
        <Sparkles class="h-3.5 w-3.5" /> 更自然的說法
      </p>
      <div class="flex items-start justify-between gap-2">
        <p class="text-sm leading-relaxed text-brand-800 dark:text-brand-200">{{ correction.natural }}</p>
        <AudioPlayButton :text="correction.natural" slow />
      </div>
    </div>

    <!-- Explanation -->
    <div v-if="correction.explanationZh" class="rounded-xl bg-ink-50 px-3.5 py-3 text-sm leading-relaxed text-ink-600">
      {{ correction.explanationZh }}
    </div>

    <!-- Grammar issues -->
    <section v-if="correction.grammarIssues.length">
      <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
        <AlertTriangle class="h-3.5 w-3.5" /> 文法問題
      </p>
      <ul class="space-y-1">
        <li v-for="(g, i) in correction.grammarIssues" :key="i" class="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{{ g }}</li>
      </ul>
    </section>

    <!-- Alternatives -->
    <section v-if="correction.alternatives.length">
      <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
        <Repeat class="h-3.5 w-3.5" /> 其他說法
      </p>
      <ul class="space-y-1">
        <li v-for="(a, i) in correction.alternatives" :key="i" class="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs text-ink-600">
          <span>{{ a }}</span><AudioPlayButton :text="a" />
        </li>
      </ul>
    </section>

    <!-- Examples -->
    <section v-if="correction.examples.length">
      <p class="mb-1.5 text-xs font-semibold text-ink-500">例句</p>
      <ul class="space-y-1">
        <li v-for="(ex, i) in correction.examples" :key="i" class="flex items-center justify-between gap-2 text-xs text-ink-600">
          <span>{{ ex }}</span><AudioPlayButton :text="ex" />
        </li>
      </ul>
    </section>
  </div>
</template>
