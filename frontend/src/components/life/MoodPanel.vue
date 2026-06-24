<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import SectionCard from '@/components/ui/SectionCard.vue'
import StatCard from '@/components/ui/StatCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { moodApi } from '@/api'
import { formatDate, todayISO, MOOD_EMOJI } from '@/utils/format'
import type { MoodRecord } from '@/types'

const { t } = useI18n()

const moods = ref<MoodRecord[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    moods.value = await moodApi.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const count = computed(() => moods.value.length)
const average = computed(() =>
  count.value ? moods.value.reduce((s, m) => s + m.moodScore, 0) / count.value : 0,
)
// Distribution across the 1–5 scale for the mini bar.
const distribution = computed(() => {
  const d: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const m of moods.value) d[m.moodScore] = (d[m.moodScore] ?? 0) + 1
  const max = Math.max(1, ...Object.values(d))
  return [1, 2, 3, 4, 5].map((score) => ({ score, n: d[score], pct: Math.round((d[score] / max) * 100) }))
})
const recent = computed(() => [...moods.value].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30))

// ---- New entry ----
const date = ref(todayISO())
const score = ref(4)
const noteText = ref('')
const saving = ref(false)

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const created = await moodApi.create({ date: date.value, moodScore: score.value, note: noteText.value.trim() || undefined })
    // Replace any same-date entry locally for a clean list.
    moods.value = [created, ...moods.value.filter((m) => m.id !== created.id)]
    noteText.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function remove(m: MoodRecord) {
  if (!window.confirm(t('common.confirmDeleteEntry'))) return
  try {
    await moodApi.remove(m.id)
    moods.value = moods.value.filter((x) => x.id !== m.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Log a mood -->
    <SectionCard :title="t('moods.title')">
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-center gap-2 sm:gap-3">
          <button
            v-for="s in [1, 2, 3, 4, 5]" :key="s"
            class="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all"
            :class="score === s ? 'scale-110 bg-brand-50 ring-2 ring-brand-300 dark:bg-brand-500/10' : 'opacity-50 hover:opacity-100'"
            @click="score = s"
          >{{ MOOD_EMOJI[s] }}</button>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <input v-model="date" type="date" class="input sm:w-44" />
          <input v-model="noteText" type="text" :placeholder="t('common.note')" class="input flex-1" />
          <button class="btn-primary btn-sm shrink-0" :disabled="saving" @click="submit">
            {{ saving ? t('common.saving') : t('common.add') }}
          </button>
        </div>
        <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
      </div>
    </SectionCard>

    <LoadingState v-if="loading" :label="t('common.loading')" />
    <ErrorState v-else-if="error && !moods.length" :message="error" @retry="load" />

    <template v-else-if="count">
      <!-- Stats -->
      <div class="grid gap-4 sm:grid-cols-2">
        <StatCard :label="t('moods.entries')" :value="count" :sub="t('moods.last30')" />
        <StatCard :label="t('moods.avgMood')" :value="`${MOOD_EMOJI[Math.round(average) || 3]} ${average.toFixed(1)}`" />
      </div>

      <!-- Distribution -->
      <SectionCard :title="t('moods.last30')">
        <div class="flex items-end justify-between gap-2 sm:gap-4">
          <div v-for="bar in distribution" :key="bar.score" class="flex flex-1 flex-col items-center gap-1.5">
            <span class="text-xs text-ink-400">{{ bar.n }}</span>
            <div class="flex h-24 w-full items-end">
              <div class="w-full rounded-t-lg bg-brand-400/80 transition-all" :style="{ height: bar.pct + '%' }" />
            </div>
            <span class="text-lg">{{ MOOD_EMOJI[bar.score] }}</span>
          </div>
        </div>
      </SectionCard>

      <!-- Recent -->
      <SectionCard :title="t('common.history')">
        <ul class="divide-y divide-ink-100">
          <li v-for="m in recent" :key="m.id" class="group flex items-center gap-3 py-2.5">
            <span class="text-2xl">{{ MOOD_EMOJI[m.moodScore] }}</span>
            <div class="min-w-0 flex-1">
              <p v-if="m.note" class="truncate text-sm text-ink-700">{{ m.note }}</p>
              <p class="text-xs text-ink-400">{{ formatDate(m.date) }}</p>
            </div>
            <button class="shrink-0 text-ink-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100" :aria-label="t('common.delete')" @click="remove(m)">
              <Trash2 class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </SectionCard>
    </template>

    <EmptyState v-else :title="t('moods.noData')" :description="t('moods.noDataDesc')" />
  </div>
</template>
