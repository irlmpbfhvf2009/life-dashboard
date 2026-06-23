<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { dashboardApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import type { DashboardData } from '@/types'
import StatCard from '@/components/ui/StatCard.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import LineChart from '@/components/charts/LineChart.vue'
import { formatDate, formatMoney, MOOD_EMOJI } from '@/utils/format'

const empty: DashboardData = {
  todayTodoCount: 0,
  todayDoneCount: 0,
  weekWeightTrend: [],
  monthExpenseTotal: 0,
  recentFoods: [],
  recentMoods: [],
  recentNotes: [],
}

const { data, loading, error, run } = useAsync<DashboardData>(dashboardApi.get, empty)
onMounted(run)

const weightChart = computed(() => ({
  labels: data.value.weekWeightTrend.map((w) => formatDate(w.date)),
  datasets: [
    {
      label: 'Weight',
      data: data.value.weekWeightTrend.map((w) => Number(w.weight)),
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79,70,229,0.12)',
      tension: 0.35,
      fill: true,
      pointRadius: 3,
    },
  ],
}))
</script>

<template>
  <div>
    <PageHeader :title="$t('dashboard.title')" :subtitle="$t('dashboard.subtitle')" />

    <LoadingSpinner v-if="loading" />
    <ErrorState v-else-if="error" :message="error" @retry="run" />

    <div v-else class="space-y-6">
      <!-- Stat cards -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard :label="$t('dashboard.todayTodos')" :value="data.todayTodoCount" accent="brand" />
        <StatCard :label="$t('dashboard.completedToday')" :value="data.todayDoneCount" accent="green" />
        <StatCard
          :label="$t('dashboard.monthSpend')"
          :value="formatMoney(data.monthExpenseTotal)"
          accent="amber"
        />
        <StatCard
          :label="$t('dashboard.latestWeight')"
          :value="data.weekWeightTrend.length ? `${data.weekWeightTrend.at(-1)?.weight} kg` : '—'"
          accent="rose"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Weight trend -->
        <div class="card p-5 lg:col-span-2">
          <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('dashboard.weeklyTrend') }}</h3>
          <LineChart v-if="data.weekWeightTrend.length" :data="weightChart" />
          <EmptyState
            v-else
            :title="$t('dashboard.noWeightWeek')"
            :description="$t('dashboard.noWeightWeekDesc')"
          />
        </div>

        <!-- Recent moods -->
        <div class="card p-5">
          <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('dashboard.recentMood') }}</h3>
          <ul v-if="data.recentMoods.length" class="space-y-3">
            <li
              v-for="m in data.recentMoods"
              :key="m.id"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-2xl">{{ MOOD_EMOJI[m.moodScore] }}</span>
              <span class="flex-1 px-3 text-slate-500 truncate">{{ m.note || '—' }}</span>
              <span class="text-xs text-slate-400">{{ formatDate(m.date) }}</span>
            </li>
          </ul>
          <EmptyState v-else :title="$t('dashboard.noMood')" :description="$t('dashboard.noMoodDesc')" />
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Recent foods -->
        <div class="card p-5">
          <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('dashboard.recentFood') }}</h3>
          <ul v-if="data.recentFoods.length" class="divide-y divide-slate-100">
            <li v-for="f in data.recentFoods" :key="f.id" class="flex items-center gap-3 py-2 text-sm">
              <span class="badge bg-brand-50 text-brand-700">{{ f.mealType }}</span>
              <span class="flex-1 truncate text-slate-700">{{ f.foodText }}</span>
              <span class="text-xs text-slate-400">{{ formatDate(f.date) }}</span>
            </li>
          </ul>
          <EmptyState v-else :title="$t('dashboard.noFood')" :description="$t('dashboard.noFoodDesc')" />
        </div>

        <!-- Quick notes -->
        <div class="card p-5">
          <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('dashboard.quickNotes') }}</h3>
          <ul v-if="data.recentNotes.length" class="space-y-3">
            <li v-for="n in data.recentNotes" :key="n.id" class="rounded-lg bg-slate-50 p-3">
              <p class="text-sm font-medium text-slate-700">{{ n.title }}</p>
              <p class="mt-1 line-clamp-2 text-xs text-slate-500">{{ n.content }}</p>
            </li>
          </ul>
          <EmptyState v-else :title="$t('dashboard.noNotes')" :description="$t('dashboard.noNotesDesc')" />
        </div>
      </div>
    </div>
  </div>
</template>
