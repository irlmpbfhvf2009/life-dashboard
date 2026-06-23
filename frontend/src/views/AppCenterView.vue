<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppCard from '@/components/ui/AppCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { studioApps, categoryMeta, type AppCategory } from '@/config/navigation'

const query = ref('')
const activeCat = ref<AppCategory | 'ALL'>('ALL')

const categories: { key: AppCategory | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'LIFE', label: categoryMeta.LIFE.label },
  { key: 'HEALTH', label: categoryMeta.HEALTH.label },
  { key: 'FINANCE', label: categoryMeta.FINANCE.label },
  { key: 'AI', label: categoryMeta.AI.label },
  { key: 'KNOWLEDGE', label: categoryMeta.KNOWLEDGE.label },
  { key: 'PORTFOLIO', label: categoryMeta.PORTFOLIO.label },
]

const filtered = computed(() =>
  studioApps.filter((a) => {
    const catOk = activeCat.value === 'ALL' || a.category === activeCat.value
    const q = query.value.trim().toLowerCase()
    const qOk = !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    return catOk && qOk
  }),
)
</script>

<template>
  <div>
    <PageHeader eyebrow="App Center" title="工具中心" subtitle="所有模組與工具的入口，依分類整理。">
      <template #actions>
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="query" class="input w-56 pl-9" placeholder="搜尋工具…" />
        </div>
      </template>
    </PageHeader>

    <!-- Category filter -->
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="c in categories"
        :key="c.key"
        class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
        :class="activeCat === c.key ? 'bg-brand-600 text-white' : 'border border-ink-200 bg-surface text-ink-600 hover:bg-ink-100'"
        @click="activeCat = c.key"
      >
        {{ c.label }}
      </button>
    </div>

    <div v-if="filtered.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AppCard v-for="app in filtered" :key="app.key" :app="app" />
    </div>
    <EmptyState v-else title="找不到符合的工具" description="試試其他關鍵字或分類。" />
  </div>
</template>
