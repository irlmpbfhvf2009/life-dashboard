<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, ShieldAlert, Bot, RefreshCw, Globe, Target, History, ListChecks, Radar } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StockAnalysisCard from '@/components/stock/StockAnalysisCard.vue'
import StockTrackTable from '@/components/stock/StockTrackTable.vue'
import RadarStockCard from '@/components/stock/RadarStockCard.vue'
import { stockResearchApi } from '@/api/stockResearch'
import { twPriceClass } from '@/utils/format'
import type { AnalysisData, PerformanceData, ArchiveData, ResultData } from '@/types/stock'

const analysis = ref<AnalysisData | null>(null)
const performance = ref<PerformanceData | null>(null)
const archive = ref<ArchiveData | null>(null)
const radar = ref<ResultData | null>(null)

const loading = ref(true)
const error = ref<string | null>(null)
const tab = ref<'current' | 'radar' | 'track' | 'archive'>('current')
const archiveLoading = ref(false)
const radarLoading = ref(false)

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

async function openRadar() {
  tab.value = 'radar'
  if (radar.value || radarLoading.value) return
  radarLoading.value = true
  try {
    radar.value = await stockResearchApi.result()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    radarLoading.value = false
  }
}

const archiveList = computed(() =>
  archive.value
    ? Object.values(archive.value.stocks).sort((a, b) => (a.analyzed_at < b.analyzed_at ? 1 : -1))
    : [],
)

const overviewBlocks = computed(() =>
  analysis.value
    ? [
        { label: '短線', text: analysis.value.overview.short_term },
        { label: '中線', text: analysis.value.overview.mid_term },
        { label: '長線', text: analysis.value.overview.long_term },
      ]
    : [],
)

const tabs = computed(() => [
  { key: 'current' as const, label: 'AI 分析', icon: Bot, count: analysis.value?.stocks.length },
  { key: 'radar' as const, label: '雷達選股', icon: Radar, count: radar.value?.stocks.length },
  { key: 'track' as const, label: 'AI 預判追蹤', icon: ListChecks, count: performance.value?.detail?.length },
  { key: 'archive' as const, label: '過往分析', icon: History, count: undefined },
])

function onTab(key: 'current' | 'radar' | 'track' | 'archive') {
  if (key === 'archive') openArchive()
  else if (key === 'radar') openRadar()
  else tab.value = key
}

onMounted(load)
</script>

<template>
  <div>
    <RouterLink to="/ai" class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
      <ArrowLeft class="h-4 w-4" /> 返回 AI 實驗室
    </RouterLink>

    <PageHeader eyebrow="AI Lab · 潛力股戰情室" title="AI 股票研究模型" subtitle="技術 / 籌碼 / 基本面多因子評分與 AI 波段研究，資料每日自動更新。">
      <template #actions>
        <button class="btn-secondary btn-sm" :disabled="loading" @click="load">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" /> 重新整理
        </button>
      </template>
    </PageHeader>

    <div class="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-500/5 p-4">
      <ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <p class="text-sm leading-relaxed text-ink-700">
        <span class="font-semibold">免責聲明：</span>本工具僅供研究與模擬分析，不構成投資建議，亦不提供任何下單或交易功能。資料來自公開來源可能有延遲或誤差，依此操作之盈虧請自行負責。
      </p>
    </div>

    <LoadingState v-if="loading" label="正在載入最新分析…" />
    <ErrorState v-else-if="error && !analysis" :message="error" @retry="load" />

    <div v-else-if="analysis" class="space-y-8">
      <!-- Performance -->
      <section v-if="performance">
        <p class="eyebrow mb-3">命中率績效</p>
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div v-for="w in performance.windows" :key="w" class="card p-5">
            <p class="text-2xs text-ink-400">{{ w }} 日命中率</p>
            <p class="mt-1.5 text-3xl font-bold text-ink-900">
              {{ performance.summary[String(w)]?.hit_rate_pct ?? '—' }}<span class="text-base text-ink-400">%</span>
            </p>
            <p class="mt-1.5 text-2xs text-ink-400">
              命中 {{ performance.summary[String(w)]?.hits }}/{{ performance.summary[String(w)]?.matured }}・最大漲幅均值 {{ performance.summary[String(w)]?.avg_max_return_pct ?? '—' }}%
            </p>
          </div>
          <div class="card flex flex-col justify-center gap-1 p-5">
            <p class="flex items-center gap-1.5 text-2xs text-ink-400"><Target class="h-3.5 w-3.5" /> 命中定義</p>
            <p class="text-sm font-semibold text-ink-800">盤中曾漲 ≥ {{ performance.target_pct }}%</p>
            <p class="text-2xs text-ink-400">只計 AI 評分 ≥ {{ performance.ai_pick_min }}/40 的看好標的</p>
          </div>
        </div>
      </section>

      <!-- Macro -->
      <section v-if="analysis.macro?.length">
        <p class="eyebrow mb-3">總經指標</p>
        <div class="flex flex-wrap gap-2.5">
          <div v-for="m in analysis.macro" :key="m.name" class="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3.5 py-2 shadow-card">
            <Globe class="h-3.5 w-3.5 text-ink-400" />
            <span class="text-xs text-ink-500">{{ m.name }}</span>
            <span class="text-sm font-semibold text-ink-800 tabular-nums">{{ m.value.toLocaleString() }}</span>
            <span class="text-2xs font-semibold tabular-nums" :class="twPriceClass(m.change_pct)">
              {{ m.change_pct >= 0 ? '+' : '' }}{{ m.change_pct }}%
            </span>
          </div>
        </div>
      </section>

      <!-- Market overview -->
      <SectionCard title="市場總覽" :icon="Bot">
        <template #action><span class="text-2xs text-ink-400">{{ analysis.model }} · {{ analysis.updated_at }}</span></template>
        <div class="space-y-4">
          <div class="surface-muted p-4">
            <p class="eyebrow mb-1.5">國際盤勢</p>
            <p class="text-sm leading-relaxed text-ink-600">{{ analysis.overview.international_summary }}</p>
          </div>
          <div class="surface-muted p-4">
            <p class="eyebrow mb-1.5">市場情緒</p>
            <p class="text-sm leading-relaxed text-ink-600">{{ analysis.overview.market_sentiment }}</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <div v-for="b in overviewBlocks" :key="b.label" class="surface-muted p-4">
              <p class="eyebrow mb-1.5">{{ b.label }}</p>
              <p class="text-sm leading-relaxed text-ink-600">{{ b.text }}</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <!-- Tabs -->
      <div>
        <div class="mb-5 flex flex-wrap gap-2">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="tab === t.key ? 'bg-brand-600 text-white' : 'border border-ink-200 bg-surface text-ink-600 hover:bg-ink-100'"
            @click="onTab(t.key)"
          >
            <component :is="t.icon" class="h-4 w-4" />
            {{ t.label }}<span v-if="t.count != null" class="opacity-70">（{{ t.count }}）</span>
          </button>
        </div>

        <!-- AI analysis -->
        <div v-if="tab === 'current'" class="space-y-3">
          <StockAnalysisCard v-for="(s, i) in analysis.stocks" :key="s.code" :stock="s" :default-open="i === 0" />
        </div>

        <!-- Radar board -->
        <div v-else-if="tab === 'radar'">
          <p class="mb-3 text-sm text-ink-500">
            每日量化選股榜：技術面 + 籌碼面 + 相對強弱篩出的強勢標的，依多因子綜合分排序<span v-if="radar"> · 更新於 {{ radar.updated_at }}</span>。
          </p>
          <LoadingState v-if="radarLoading" label="正在載入雷達清單…" />
          <EmptyState v-else-if="!radar?.stocks.length" title="今日無符合條件的標的" />
          <div v-else class="space-y-3">
            <RadarStockCard v-for="(s, i) in radar.stocks" :key="s.code" :stock="s" :default-open="i === 0" />
          </div>
        </div>

        <!-- Track record -->
        <div v-else-if="tab === 'track'">
          <p class="mb-3 text-sm text-ink-500">
            AI 看好的股（八面向評分 ≥ {{ performance?.ai_pick_min }}/40）事後真實表現——命中＝預判日後視窗內盤中曾漲 ≥ {{ performance?.target_pct }}%。
          </p>
          <StockTrackTable
            v-if="performance?.detail?.length"
            :rows="performance.detail"
            :windows="performance.windows"
          />
          <EmptyState v-else title="尚無追蹤紀錄" />
        </div>

        <!-- Archive -->
        <div v-else>
          <LoadingState v-if="archiveLoading" label="正在載入過往分析…" />
          <EmptyState v-else-if="!archiveList.length" title="尚無過往分析" />
          <div v-else class="space-y-3">
            <StockAnalysisCard v-for="s in archiveList" :key="s.code + s.analyzed_at" :stock="s" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
