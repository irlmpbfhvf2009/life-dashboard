<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, HeartPulse, Smile, Sparkles, Scale, UtensilsCrossed, Lock, CalendarDays,
} from 'lucide-vue-next'
import StatCard from '@/components/ui/StatCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import TrendChartCard from '@/components/ui/TrendChartCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { socialApi } from '@/api'
import type { FriendProfile } from '@/types'

const route = useRoute()
const router = useRouter()

const profile = ref<FriendProfile | null>(null)
const loading = ref(true)
const error = ref('')

const mealLabels: Record<string, string> = {
  BREAKFAST: '早餐', LUNCH: '午餐', DINNER: '晚餐', SNACK: '點心',
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    profile.value = await socialApi.profile(Number(route.params.userId))
  } catch (e) {
    error.value = (e as Error).message || '載入失敗'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const avatarText = computed(() => {
  const p = profile.value
  return (p?.displayName || p?.email || '?').charAt(0).toUpperCase()
})

const weightTrend = computed(() => {
  const t = profile.value?.health?.weightTrend ?? []
  return { labels: t.map((w) => fmtDate(w.date)), data: t.map((w) => Number(w.weight)) }
})
const moodTrend = computed(() => {
  const m = profile.value?.mood?.recent ?? []
  return { labels: m.map((x) => fmtDate(x.date)), data: m.map((x) => x.moodScore) }
})

// Whether every shareable module is hidden — to show a single "nothing shared" hint.
const nothingShared = computed(() => {
  const v = profile.value?.visibility
  return v && !v.health && !v.mood && !v.life
})
</script>

<template>
  <div>
    <button class="btn-ghost btn-sm mb-4 gap-1.5" @click="router.back()">
      <ArrowLeft class="h-4 w-4" /> 返回
    </button>

    <p v-if="error" class="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">{{ error }}</p>
    <p v-else-if="loading" class="text-sm text-ink-400">載入中…</p>

    <template v-else-if="profile">
      <!-- Identity header -->
      <div class="card mb-6 flex items-center gap-4 p-6">
        <img v-if="profile.photoUrl" :src="profile.photoUrl" alt="" class="h-16 w-16 rounded-2xl object-cover" referrerpolicy="no-referrer" />
        <span v-else class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-xl font-semibold text-brand-700">{{ avatarText }}</span>
        <div class="min-w-0">
          <h1 class="page-title">{{ profile.displayName || '—' }}</h1>
          <p class="mt-0.5 truncate text-sm text-ink-400">{{ profile.email }}</p>
          <p class="mt-1 inline-flex items-center gap-1 text-xs text-ink-400">
            <CalendarDays class="h-3.5 w-3.5" /> 加入於 {{ new Date(profile.joinedAt).toLocaleDateString('zh-TW') }}
          </p>
        </div>
      </div>

      <EmptyState
        v-if="nothingShared"
        :icon="Lock" title="這位好友尚未公開任何資料"
        description="對方可以在「社交 → 隱私設定」選擇要分享的項目。"
      />

      <div v-else class="space-y-6">
        <!-- Health -->
        <SectionCard v-if="profile.health" title="健康減脂" :icon="HeartPulse">
          <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="最新體重"
              :value="profile.health.latestWeight ? `${profile.health.latestWeight.weight} kg` : '—'"
              :sub="profile.health.latestWeight ? fmtDate(profile.health.latestWeight.date) : undefined"
              :icon="Scale"
            />
          </div>
          <TrendChartCard
            v-if="weightTrend.data.length"
            title="近 30 天體重趨勢"
            :labels="weightTrend.labels"
            :data="weightTrend.data"
            color="#10b981"
            unit="kg"
          />
          <p v-else class="text-sm text-ink-400">尚無體重紀錄。</p>

          <div v-if="profile.health.recentFoods.length" class="mt-4">
            <p class="mb-2 text-xs font-medium text-ink-500">近期飲食</p>
            <div class="space-y-1.5">
              <div v-for="f in profile.health.recentFoods" :key="f.id" class="flex items-center gap-2.5 rounded-xl bg-ink-50/60 px-3 py-2 text-sm">
                <UtensilsCrossed class="h-4 w-4 shrink-0 text-ink-400" />
                <span class="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-2xs text-ink-500">{{ mealLabels[f.mealType] || f.mealType }}</span>
                <span class="min-w-0 flex-1 truncate text-ink-700">{{ f.foodText }}</span>
                <span class="shrink-0 text-2xs text-ink-400">{{ fmtDate(f.date) }}</span>
              </div>
            </div>
          </div>
        </SectionCard>

        <!-- Mood -->
        <SectionCard v-if="profile.mood" title="心情日記" :icon="Smile">
          <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="平均心情"
              :value="profile.mood.average != null ? profile.mood.average.toFixed(1) : '—'"
              sub="近 30 天 / 5 分"
              :icon="Smile"
            />
            <StatCard label="紀錄筆數" :value="profile.mood.recent.length" sub="近 30 天" :icon="CalendarDays" />
          </div>
          <TrendChartCard
            v-if="moodTrend.data.length"
            title="心情走勢"
            :labels="moodTrend.labels"
            :data="moodTrend.data"
            color="#f59e0b"
          />
          <p v-else class="text-sm text-ink-400">尚無心情紀錄。</p>
        </SectionCard>

        <!-- Life -->
        <SectionCard v-if="profile.life" title="待辦 / 生活" :icon="Sparkles">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="待完成" :value="profile.life.openTodos" sub="所有未完成待辦" :icon="Sparkles" />
            <StatCard label="今日待辦" :value="profile.life.todayTodos" :icon="CalendarDays" />
            <StatCard label="今日已完成" :value="profile.life.todayDone" :icon="CalendarDays" />
          </div>
        </SectionCard>
      </div>
    </template>
  </div>
</template>
