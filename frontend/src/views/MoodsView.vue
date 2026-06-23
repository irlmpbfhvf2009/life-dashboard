<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { moodApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import type { MoodRecord, MoodStats } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import BarChart from '@/components/charts/BarChart.vue'
import { formatDate, todayISO, MOOD_EMOJI } from '@/utils/format'

const emptyStats: MoodStats = { count: 0, average: null, distribution: {}, points: [] }

const { data: stats, loading: statsLoading, error: statsError, run: loadStats } =
  useAsync<MoodStats>(() => moodApi.stats(30), emptyStats)
const { data: list, loading: listLoading, error: listError, run: loadList } =
  useAsync<MoodRecord[]>(moodApi.list, [])

const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({ date: todayISO(), moodScore: 3, note: '' })

onMounted(() => {
  loadStats()
  loadList()
})

async function refreshAll() {
  await Promise.all([loadStats(), loadList()])
}

async function add() {
  saving.value = true
  formError.value = null
  try {
    await moodApi.create({ date: form.date, moodScore: form.moodScore, note: form.note.trim() || undefined })
    form.note = ''
    await refreshAll()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function remove(rec: MoodRecord) {
  if (!confirm('Delete this entry?')) return
  await moodApi.remove(rec.id)
  await refreshAll()
}

const chart = computed(() => ({
  labels: [1, 2, 3, 4, 5].map((s) => `${MOOD_EMOJI[s]} ${s}`),
  datasets: [
    {
      data: [1, 2, 3, 4, 5].map((s) => stats.value.distribution[String(s)] ?? 0),
      backgroundColor: '#6366f1',
      borderRadius: 6,
    },
  ],
}))
</script>

<template>
  <div>
    <PageHeader title="Mood" subtitle="How are you feeling?" />

    <form class="card mb-6 flex flex-wrap items-end gap-4 p-4" @submit.prevent="add">
      <div>
        <label class="label">Date</label>
        <input v-model="form.date" type="date" class="input w-40" />
      </div>
      <div>
        <label class="label">Mood</label>
        <div class="flex gap-1">
          <button
            v-for="s in [1, 2, 3, 4, 5]"
            :key="s"
            type="button"
            class="rounded-lg px-2 py-1 text-2xl transition"
            :class="form.moodScore === s ? 'bg-brand-100 scale-110' : 'opacity-50 hover:opacity-100'"
            @click="form.moodScore = s"
          >
            {{ MOOD_EMOJI[s] }}
          </button>
        </div>
      </div>
      <div class="min-w-[12rem] flex-1">
        <label class="label">Note</label>
        <input v-model="form.note" class="input" placeholder="Optional" />
      </div>
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? 'Saving…' : 'Add' }}
      </button>
      <p v-if="formError" class="w-full text-sm text-red-600">{{ formError }}</p>
    </form>

    <div class="card mb-6 p-5">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">Last 30 days</h3>
      <LoadingSpinner v-if="statsLoading" />
      <ErrorState v-else-if="statsError" :message="statsError" @retry="loadStats" />
      <template v-else>
        <div class="mb-4 grid grid-cols-2 gap-3">
          <StatCard label="Entries" :value="stats.count" />
          <StatCard
            label="Average mood"
            :value="stats.average != null ? stats.average.toFixed(1) : '—'"
            accent="green"
          />
        </div>
        <BarChart v-if="stats.count" :data="chart" />
        <EmptyState v-else title="No mood data" description="Log your mood to see the distribution." />
      </template>
    </div>

    <div class="card p-5">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">History</h3>
      <LoadingSpinner v-if="listLoading" />
      <ErrorState v-else-if="listError" :message="listError" @retry="loadList" />
      <EmptyState v-else-if="!list.length" title="No entries yet" />
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="rec in list" :key="rec.id" class="flex items-center gap-3 py-3 text-sm">
          <span class="text-2xl">{{ MOOD_EMOJI[rec.moodScore] }}</span>
          <span class="flex-1 truncate text-slate-500">{{ rec.note }}</span>
          <span class="text-xs text-slate-400">{{ formatDate(rec.date) }}</span>
          <button class="text-slate-300 hover:text-red-500" @click="remove(rec)">🗑</button>
        </li>
      </ul>
    </div>
  </div>
</template>
