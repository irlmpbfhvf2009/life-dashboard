<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Award, Target, ArrowRight, Mic, BookOpen } from 'lucide-vue-next'
import type { PlacementResult } from '@/types/english'

const props = defineProps<{ result: PlacementResult }>()
const router = useRouter()
const { t } = useI18n()

const LEVEL_META: Record<string, { cefr: string; cls: string }> = {
  BEGINNER: { cefr: 'A1–A2', cls: 'from-emerald-500 to-teal-500' },
  INTERMEDIATE: { cefr: 'B1–B2', cls: 'from-amber-500 to-orange-500' },
  ADVANCED: { cefr: 'C1', cls: 'from-violet-500 to-indigo-500' },
}
const meta = computed(() => LEVEL_META[props.result.estimatedLevel])
</script>

<template>
  <div class="space-y-5">
    <!-- Level banner -->
    <div class="card flex items-center gap-5 bg-gradient-to-br p-6 text-white" :class="meta.cls">
      <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20">
        <Award class="h-8 w-8" />
      </div>
      <div>
        <p class="text-sm font-medium text-white/80">{{ t('ec.placement.estimated') }}</p>
        <p class="text-2xl font-bold">{{ t('ec.level.' + result.estimatedLevel) }} · {{ meta.cefr }}</p>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <!-- Weaknesses -->
      <section class="card p-5">
        <p class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><Target class="h-4 w-4 text-amber-500" /> {{ t('ec.placement.weaknesses') }}</p>
        <div v-if="result.weaknesses.length" class="flex flex-wrap gap-1.5">
          <span v-for="w in result.weaknesses" :key="w" class="badge badge-amber">{{ w }}</span>
        </div>
        <p v-else class="text-sm text-emerald-600">{{ t('ec.placement.noWeakness') }}</p>
      </section>

      <!-- Speaking focus -->
      <section class="card p-5">
        <p class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><Mic class="h-4 w-4 text-rose-500" /> {{ t('ec.placement.speakingFocus') }}</p>
        <ul class="space-y-1.5">
          <li v-for="s in result.speakingFocus" :key="s" class="text-sm text-ink-600">· {{ s }}</li>
        </ul>
      </section>
    </div>

    <!-- Suggested units -->
    <section class="card p-5">
      <p class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><BookOpen class="h-4 w-4 text-brand-500" /> {{ t('ec.placement.suggestedUnits') }}</p>
      <div class="flex flex-wrap gap-2">
        <span v-for="u in result.suggestedUnits" :key="u" class="rounded-xl border border-ink-200 px-3 py-1.5 text-sm text-ink-600">{{ u }}</span>
      </div>
    </section>

    <div class="flex flex-wrap gap-2">
      <button class="btn-primary btn-sm gap-1.5" @click="router.push('/ai/english/path')">
        {{ t('ec.placement.viewPath') }} <ArrowRight class="h-3.5 w-3.5" />
      </button>
      <button class="btn-secondary btn-sm" @click="router.push('/ai/english')">{{ t('ec.act.backHome') }}</button>
    </div>
  </div>
</template>
