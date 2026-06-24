<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ScenarioCard from '@/components/english/ScenarioCard.vue'
import { englishApi } from '@/api/english'
import { SCENARIO_LABELS } from '@/data/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { EnglishScenario, ScenarioCategory } from '@/types/english'

const router = useRouter()
const store = useEnglishStore()

const scenarios = ref<EnglishScenario[]>([])
const loading = ref(true)
const activeCat = ref<ScenarioCategory | 'all'>('all')

onMounted(async () => {
  scenarios.value = await englishApi.getScenarios()
  // Reflect completion from local state.
  const done = new Set(store.data.value?.completedScenarioIds ?? [])
  scenarios.value.forEach((s) => { if (done.has(s.id)) s.status = 'DONE' })
  loading.value = false
})

const categories = computed(() => {
  const set = new Set(scenarios.value.map((s) => s.category))
  return ['all', ...Array.from(set)] as (ScenarioCategory | 'all')[]
})
const filtered = computed(() =>
  activeCat.value === 'all' ? scenarios.value : scenarios.value.filter((s) => s.category === activeCat.value),
)

function start(s: EnglishScenario) {
  router.push(`/ai/english/conversation/${s.id}`)
}
</script>

<template>
  <PageHeader eyebrow="AI English · 情境練習" title="情境練習" subtitle="挑一個真實情境，和 AI 角色用英文完成任務並獲得即時回饋。" />

  <LoadingState v-if="loading" label="載入情境…" />

  <template v-else>
    <div class="mb-5 flex flex-wrap gap-1.5">
      <button
        v-for="c in categories" :key="c"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="activeCat === c ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:border-ink-300'"
        @click="activeCat = c"
      >{{ c === 'all' ? '全部' : SCENARIO_LABELS[c] }}</button>
    </div>

    <EmptyState v-if="!filtered.length" title="此分類暫無情境" description="換個分類看看。" />
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ScenarioCard v-for="s in filtered" :key="s.id" :scenario="s" @start="start" />
    </div>
  </template>
</template>
