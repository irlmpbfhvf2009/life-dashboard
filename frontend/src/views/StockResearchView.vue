<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowLeft, ShieldAlert, Bot, RefreshCw, Globe, Target, History, ListChecks, Radar, Sparkles,
  Activity, Zap, Gauge, Compass,
} from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StockAnalysisCard from '@/components/stock/StockAnalysisCard.vue'
import StockTrackTable from '@/components/stock/StockTrackTable.vue'
import RadarStockCard from '@/components/stock/RadarStockCard.vue'
import AiPickCard from '@/components/stock/AiPickCard.vue'
import { stockResearchApi } from '@/api/stockResearch'
import { twPriceClass, highlightTerms } from '@/utils/format'
import type { AnalysisData, PerformanceData, ArchiveData, ResultData, RadarStock } from '@/types/stock'

const analysis = ref<AnalysisData | null>(null)
const performance = ref<PerformanceData | null>(null)
const archive = ref<ArchiveData | null>(null)
const radar = ref<ResultData | null>(null)

const loading = ref(true)
const error = ref<string | null>(null)
const tab = ref<'current' | 'radar' | 'track' | 'archive'>('current')
const archiveLoading = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [a, p, r] = await Promise.all([
      stockResearchApi.analysis(),
      stockResearchApi.performance(),
      stockResearchApi.result(),
    ])
    analysis.value = a
    performance.value = p
    radar.value = r
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// Merge AI analysis with its radar/quote data by stock code.
const radarByCode = computed<Record<string, RadarStock>>(() => {
  const map: Record<string, RadarStock> = {}
  radar.value?.stocks.forEach((s) => (map[s.code] = s))
  return map
})
const aiPicks = computed(() =>
  (analysis.value?.stocks ?? []).map((ai) => ({ ai, radar: radarByCode.value[ai.code] })),
)
// Whether the current AI hit-rate sample is still small.
const smallSample = computed(() => {
  const m = performance.value?.summary
  if (!m) return false
  return Math.max(...Object.values(m).map((w) => w.matured)) < 10
})

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

const toneMap: Record<string, { card: string; icon: string; label: string }> = {
  sky: { card: 'border-sky-500/20 bg-sky-500/5', icon: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', label: 'text-sky-600 dark:text-sky-400' },
  violet: { card: 'border-violet-500/20 bg-violet-500/5', icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', label: 'text-violet-600 dark:text-violet-400' },
  amber: { card: 'border-amber-500/20 bg-amber-500/5', icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'text-amber-600 dark:text-amber-400' },
  brand: { card: 'border-brand-500/20 bg-brand-500/5', icon: 'bg-brand-500/10 text-brand-600 dark:text-brand-300', label: 'text-brand-600 dark:text-brand-300' },
  emerald: { card: 'border-emerald-500/20 bg-emerald-500/5', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'text-emerald-600 dark:text-emerald-400' },
}

const overviewItems = computed(() =>
  analysis.value
    ? [
        { label: '國際盤勢', text: analysis.value.overview.international_summary, tone: 'sky', icon: Globe, wide: true },
        { label: '市場情緒', text: analysis.value.overview.market_sentiment, tone: 'violet', icon: Activity, wide: true },
        { label: '短線', text: analysis.value.overview.short_term, tone: 'amber', icon: Zap, wide: false },
        { label: '中線', text: analysis.value.overview.mid_term, tone: 'brand', icon: Gauge, wide: false },
        { label: '長線', text: analysis.value.overview.long_term, tone: 'emerald', icon: Compass, wide: false },
      ]
    : [],
)

const tabs = computed(() => [
  { key: 'current' as const, label: '今日 AI 精選', icon: Sparkles, count: analysis.value?.stocks.length },
  { key: 'radar' as const, label: '雷達選股', icon: Radar, count: radar.value?.stocks.length },
  { key: 'track' as const, label: 'AI 預判追蹤', icon: ListChecks, count: performance.value?.detail?.length },
  { key: 'archive' as const, label: '過往分析', icon: History, count: undefined },
])

function onTab(key: 'current' | 'radar' | 'track' | 'archive') {
  if (key === 'archive') openArchive()
  else tab.value = key
}

onMounted(load)
</script>

<template>
  <div>
    <RouterLink to="/ai" class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
      <ArrowLeft class="h-4 w-4" /> 返回 AI 實驗室
    </RouterLink>

    <PageHeader :icon="Activity" eyebrow="AI Lab · 潛力股戰情室" title="AI 股票研究模型" subtitle="技術 / 籌碼 / 基本面多因子評分與 AI 波段研究，資料每日自動更新。">
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
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <p class="eyebrow">命中率績效</p>
          <span v-if="smallSample" class="badge-amber">樣本仍少，僅供參考</span>
        </div>
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div v-for="w in performance.windows" :key="w" class="card p-5">
            <p class="text-2xs text-ink-400">{{ w }} 日命中率</p>
            <p class="mt-1.5 text-3xl font-bold text-ink-900">
              {{ performance.summary[String(w)]?.hit_rate_pct ?? '—' }}<span class="text-base text-ink-400">%</span>
            </p>
            <p class="mt-1.5 text-2xs text-ink-400">
              已到期 {{ performance.summary[String(w)]?.matured }} 筆中命中 {{ performance.summary[String(w)]?.hits }}・進行中 {{ performance.summary[String(w)]?.in_progress }}
            </p>
          </div>
          <div class="card flex flex-col justify-center gap-1 p-5">
            <p class="flex items-center gap-1.5 text-2xs text-ink-400"><Target class="h-3.5 w-3.5" /> 命中定義</p>
            <p class="text-sm font-semibold text-ink-800">N 日內盤中曾漲 ≥ {{ performance.target_pct }}%</p>
            <p class="text-2xs text-ink-400">只計 AI 評分 ≥ {{ performance.ai_pick_min }}/40 的看好標的</p>
          </div>
        </div>
        <p class="mt-2.5 text-2xs leading-relaxed text-ink-400">
          命中率只計算「已到期」樣本（5 日視窗約需一週、20 日約一個月才到期），未到期的標的列入「進行中」、不影響分母。同一檔若在 5 日內命中，10/20 日視窗亦同步計命中，故三欄常一致。樣本累積越多、數字越可信。
        </p>
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
          <div
            v-for="item in overviewItems.filter((i) => i.wide)"
            :key="item.label"
            class="rounded-xl border p-4"
            :class="toneMap[item.tone].card"
          >
            <p class="mb-2 flex items-center gap-2 text-sm font-semibold" :class="toneMap[item.tone].label">
              <span class="flex h-6 w-6 items-center justify-center rounded-lg" :class="toneMap[item.tone].icon">
                <component :is="item.icon" class="h-3.5 w-3.5" :stroke-width="2.25" />
              </span>
              {{ item.label }}
            </p>
            <p class="text-sm leading-relaxed text-ink-700" v-html="highlightTerms(item.text)" />
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div
              v-for="item in overviewItems.filter((i) => !i.wide)"
              :key="item.label"
              class="rounded-xl border p-4"
              :class="toneMap[item.tone].card"
            >
              <p class="mb-2 flex items-center gap-2 text-sm font-semibold" :class="toneMap[item.tone].label">
                <span class="flex h-6 w-6 items-center justify-center rounded-lg" :class="toneMap[item.tone].icon">
                  <component :is="item.icon" class="h-3.5 w-3.5" :stroke-width="2.25" />
                </span>
                {{ item.label }}
              </p>
              <p class="text-sm leading-relaxed text-ink-700" v-html="highlightTerms(item.text)" />
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

        <!-- Today's AI picks (merged quote + AI analysis) -->
        <div v-if="tab === 'current'" class="space-y-4">
          <p class="text-sm text-ink-500">綜合分最高、且已做 AI 八面向分析的標的（附 K 線、技術、籌碼、基本面與操作參考）。</p>
          <EmptyState v-if="!aiPicks.length" title="尚無 AI 精選" description="等下次 AI 分析更新。" />
          <AiPickCard v-for="p in aiPicks" :key="p.ai.code" :ai="p.ai" :radar="p.radar" />
        </div>

        <!-- Radar board -->
        <div v-else-if="tab === 'radar'">
          <p class="mb-3 text-sm text-ink-500">
            每日量化選股榜：技術面 + 籌碼面 + 相對強弱篩出的強勢標的，依多因子綜合分排序<span v-if="radar"> · 更新於 {{ radar.updated_at }}</span>。
          </p>
          <EmptyState v-if="!radar?.stocks.length" title="今日無符合條件的標的" />
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
