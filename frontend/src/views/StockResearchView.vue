<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, ShieldAlert, Bot, RefreshCw, Globe } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StockAnalysisCard from '@/components/stock/StockAnalysisCard.vue'
import { stockResearchApi } from '@/api/stockResearch'
import type { AnalysisData, PerformanceData, ArchiveData } from '@/types/stock'

const analysis = ref<AnalysisData | null>(null)
const performance = ref<PerformanceData | null>(null)
const archive = ref<ArchiveData | null>(null)

const loading = ref(true)
const error = ref<string | null>(null)
const tab = ref<'current' | 'archive'>('current')
const archiveLoading = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [a, p] = await Promise.all([stockResearchApi.analysis(), stockResearchApi.performance()])
    analysis.value = a
    performance.value = p
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function openArchive() {
  tab.value = 'archive'
  if (archive.value || archiveLoading.value) return
  archiveLoading.value = true
  try {
    archive.value = await stockResearchApi.archive()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    archiveLoading.value = false
  }
}

const archiveList = computed(() =>
  archive.value
    ? Object.values(archive.value.stocks).sort((a, b) => (a.analyzed_at < b.analyzed_at ? 1 : -1))
    : [],
)

onMounted(load)
</script>

<template>
  <div>
    <RouterLink to="/ai" class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
      <ArrowLeft class="h-4 w-4" /> 返回 AI 實驗室
    </RouterLink>

    <PageHeader eyebrow="AI Lab · 潛力股戰情室" title="AI 股票研究模型" subtitle="技術 / 籌碼 / 基本面多因子評分與 AI 波段研究（資料每日自動更新）。">
      <template #actions>
        <button class="btn-secondary btn-sm" :disabled="loading" @click="load">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" /> 重新整理
        </button>
      </template>
    </PageHeader>

    <!-- Disclaimer -->
    <div class="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-500/5 p-4">
      <ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <p class="text-sm text-ink-700">
        <span class="font-semibold">免責聲明：</span>本工具僅供研究與模擬分析，不構成投資建議，亦不提供任何下單或交易功能。資料來自公開來源可能有延遲或誤差，依此操作之盈虧請自行負責。
      </p>
    </div>

    <LoadingState v-if="loading" label="正在載入最新分析…" />
    <ErrorState v-else-if="error && !analysis" :message="error" @retry="load" />

    <template v-else-if="analysis">
      <!-- Performance strip -->
      <section v-if="performance" class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div v-for="w in performance.windows" :key="w" class="card p-4">
          <p class="text-2xs text-ink-400">{{ w }} 日命中率</p>
          <p class="mt-1 text-2xl font-bold text-ink-900">
            {{ performance.summary[String(w)]?.hit_rate_pct ?? '—' }}<span class="text-sm text-ink-400">%</span>
          </p>
          <p class="mt-0.5 text-2xs text-ink-400">
            命中 {{ performance.summary[String(w)]?.hits }}/{{ performance.summary[String(w)]?.matured }}・最大漲幅均值 {{ performance.summary[String(w)]?.avg_max_return_pct ?? '—' }}%
          </p>
        </div>
        <div class="card flex flex-col justify-center p-4">
          <p class="text-2xs text-ink-400">模型 / 目標</p>
          <p class="mt-1 text-sm font-semibold text-ink-800">命中＝盤中曾漲 ≥ {{ performance.target_pct }}%</p>
          <p class="mt-0.5 text-2xs text-ink-400">只計 AI 評分 ≥ {{ performance.ai_pick_min }}/40 的看好標的</p>
        </div>
      </section>

      <!-- Macro indices -->
      <section v-if="analysis.macro?.length" class="mb-6 flex flex-wrap gap-2.5">
        <div v-for="m in analysis.macro" :key="m.name" class="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 shadow-card">
          <Globe class="h-3.5 w-3.5 text-ink-400" />
          <span class="text-xs text-ink-500">{{ m.name }}</span>
          <span class="text-sm font-semibold text-ink-800">{{ m.value.toLocaleString() }}</span>
          <span class="text-2xs font-semibold" :class="m.change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'">
            {{ m.change_pct >= 0 ? '+' : '' }}{{ m.change_pct }}%
          </span>
        </div>
      </section>

      <!-- Market overview -->
      <SectionCard title="市場總覽" :icon="Bot" class="mb-6">
        <template #action><span class="text-2xs text-ink-400">{{ analysis.model }} · {{ analysis.updated_at }}</span></template>
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="(v, label) in {
            '國際盤勢': analysis.overview.international_summary,
            '市場情緒': analysis.overview.market_sentiment,
            '短線': analysis.overview.short_term,
            '中線': analysis.overview.mid_term,
            '長線': analysis.overview.long_term,
          }" :key="label" class="surface-muted p-3.5">
            <p class="eyebrow mb-1">{{ label }}</p>
            <p class="text-sm leading-relaxed text-ink-600">{{ v }}</p>
          </div>
        </div>
      </SectionCard>

      <!-- Tabs -->
      <div class="mb-4 flex gap-2">
        <button class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          :class="tab === 'current' ? 'bg-brand-600 text-white' : 'border border-ink-200 bg-surface text-ink-600 hover:bg-ink-100'"
          @click="tab = 'current'">
          今日分析（{{ analysis.stocks.length }}）
        </button>
        <button class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          :class="tab === 'archive' ? 'bg-brand-600 text-white' : 'border border-ink-200 bg-surface text-ink-600 hover:bg-ink-100'"
          @click="openArchive">
          過往分析
        </button>
      </div>

      <!-- Current -->
      <div v-if="tab === 'current'" class="space-y-3">
        <StockAnalysisCard
          v-for="(s, i) in analysis.stocks"
          :key="s.code"
          :stock="s"
          :default-open="i === 0"
        />
      </div>

      <!-- Archive -->
      <div v-else>
        <LoadingState v-if="archiveLoading" label="正在載入過往分析…" />
        <EmptyState v-else-if="!archiveList.length" title="尚無過往分析" />
        <div v-else class="space-y-3">
          <StockAnalysisCard v-for="s in archiveList" :key="s.code + s.analyzed_at" :stock="s" />
        </div>
      </div>
    </template>
  </div>
</template>
