<script setup lang="ts">
import { computed } from 'vue'
import { Repeat, CheckCircle2, Layers } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import ReviewQueueCard from '@/components/english/ReviewQueueCard.vue'
import MasteryProgressBadge from '@/components/english/MasteryProgressBadge.vue'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { ReviewItem } from '@/types/english'

const store = useEnglishStore()

const due = computed(() => store.dueReviews.value)
const current = computed(() => due.value[0])
const reviewedToday = computed(() => store.reviewedToday.value)
const masteredCount = computed(() => store.reviews.value.filter((r) => r.status === 'MASTERED').length)
const completionRate = computed(() => {
  const total = reviewedToday.value + due.value.length
  return total ? Math.round((reviewedToday.value / total) * 100) : 100
})

// For mistake reviews, reveal the correction + note from the linked mistake.
function detailFor(item: ReviewItem): string | undefined {
  if (item.refType !== 'mistake') return undefined
  const m = store.mistakes.value.find((x) => x.id === item.refId)
  if (!m) return undefined
  return m.note ? `✓ ${m.corrected}\n${m.note}` : `✓ ${m.corrected}`
}

function complete(remembered: boolean) {
  if (current.value) store.reviewComplete(current.value.id, remembered)
}

// Status breakdown for the "全部項目" overview.
const breakdown = computed(() => {
  const order: ReviewItem['status'][] = ['NEW', 'LEARNING', 'REVIEWING', 'MASTERED']
  const counts: Record<string, number> = {}
  for (const r of store.reviews.value) counts[r.status] = (counts[r.status] ?? 0) + 1
  return order.map((s) => ({ status: s, n: counts[s] ?? 0 }))
})
</script>

<template>
  <PageHeader eyebrow="AI English · 複習成長" title="複習" subtitle="用間隔複習鞏固單字、句型與常錯句：記得就拉長間隔，忘記就明天再來。" />

  <div class="mb-6 grid gap-4 sm:grid-cols-3">
    <LearningStatCard label="今日待複習" :value="due.length" sub="到期項目" :icon="Repeat" accent="text-amber-500 bg-amber-50" />
    <LearningStatCard label="今日完成率" :value="`${completionRate}%`" :sub="`已複習 ${reviewedToday} 項`" :ring="completionRate" />
    <LearningStatCard label="已掌握" :value="masteredCount" sub="累積掌握" :icon="CheckCircle2" accent="text-emerald-500 bg-emerald-50" />
  </div>

  <!-- Today's queue -->
  <div v-if="current" class="mb-6">
    <ReviewQueueCard :item="current" :detail="detailFor(current)" @complete="complete" />
  </div>
  <SectionCard v-else class="mb-6">
    <div class="flex flex-col items-center gap-3 py-10 text-center">
      <CheckCircle2 class="h-8 w-8 text-emerald-500" />
      <p class="text-sm font-semibold text-ink-700">今日複習完成！</p>
      <p class="max-w-sm text-xs text-ink-400">所有到期項目都複習過了。去學新單字、句型或對話，明天再回來複習。</p>
    </div>
  </SectionCard>

  <!-- All items overview -->
  <SectionCard :icon="Layers" title="全部複習項目">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div v-for="b in breakdown" :key="b.status" class="flex flex-col items-center gap-1.5 rounded-2xl bg-ink-50 px-3 py-4">
        <span class="text-2xl font-bold text-ink-900">{{ b.n }}</span>
        <MasteryProgressBadge :status="b.status" />
      </div>
    </div>
  </SectionCard>
</template>
