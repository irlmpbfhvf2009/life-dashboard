<script setup lang="ts">
import { ref } from 'vue'
import {
  ChevronDown, TrendingUp, TrendingDown, Target, ShieldAlert,
  Eye, LogOut, FileText, Sparkles, Building2,
} from 'lucide-vue-next'
import type { AnalysisStock, RadarStock, ScoreKey } from '@/types/stock'
import CandleChart from './CandleChart.vue'
import { twPriceClass, highlightTerms } from '@/utils/format'

defineProps<{ ai: AnalysisStock; radar?: RadarStock }>()
const detailOpen = ref(false)

const DIMS: { key: ScoreKey; label: string }[] = [
  { key: 'fundamental', label: '基本面' },
  { key: 'valuation', label: '估值面' },
  { key: 'chips', label: '籌碼面' },
  { key: 'technical', label: '技術面' },
  { key: 'industry', label: '產業趨勢' },
  { key: 'catalyst', label: '重大新聞' },
  { key: 'expectation', label: '預期差' },
  { key: 'risk', label: '風險' },
]
const DETAIL: { key: string; label: string }[] = [
  { key: 'financials', label: '基本面（8季）' },
  { key: 'valuation', label: '估值面' },
  { key: 'chips', label: '籌碼面' },
  { key: 'technical', label: '技術面' },
  { key: 'industry', label: '產業趨勢' },
  { key: 'news', label: '重大新聞' },
  { key: 'expectation', label: '預期差' },
  { key: 'risks', label: '風險逐項' },
]
function barColor(s: number) {
  return s >= 4 ? 'bg-emerald-500' : s >= 3 ? 'bg-amber-500' : 'bg-rose-500'
}
function compositeCls(v?: number) {
  if (v == null) return 'badge-gray'
  return v >= 70 ? 'badge-rose' : v >= 55 ? 'badge-amber' : 'badge-gray'
}
</script>

<template>
  <div class="card overflow-hidden">
    <!-- ===== Quote header ===== -->
    <div class="p-5">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-baseline gap-2">
            <span class="text-xl font-bold tracking-tight text-ink-900">{{ ai.code }}</span>
            <span class="text-sm text-ink-500">{{ ai.name }}</span>
          </div>
          <div v-if="radar?.industry" class="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500">
            <Building2 class="h-3.5 w-3.5 text-ink-400" />
            {{ radar.industry.name }}
            <span class="text-ink-400">{{ radar.industry.strength }}</span>
            <span class="text-ink-300">· 族群排名 {{ radar.industry.rank }}/{{ radar.industry.total }}</span>
          </div>
        </div>
        <div class="text-right">
          <p v-if="radar" class="text-xl font-bold tabular-nums text-ink-900">{{ radar.price }}</p>
          <p v-if="radar" class="text-sm font-semibold tabular-nums" :class="twPriceClass(radar.change_pct)">
            {{ radar.change_pct >= 0 ? '+' : '' }}{{ radar.change_pct }}%
          </p>
          <span v-if="radar?.composite_score != null" class="badge mt-1" :class="compositeCls(radar.composite_score)">
            綜合 {{ radar.composite_score.toFixed(1) }}
          </span>
        </div>
      </div>

      <!-- K-line -->
      <div v-if="radar?.ohlc?.length" class="mt-4">
        <CandleChart :ohlc="radar.ohlc" :ma60="radar.ma60" :ma240="radar.ma240" />
      </div>

      <!-- Metric boxes -->
      <div v-if="radar" class="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div v-for="m in [
          { l: '季線', v: radar.ma60 },
          { l: '年線', v: radar.ma240 },
          { l: 'RSI', v: radar.rsi },
          { l: '量比', v: radar.volume_ratio },
        ]" :key="m.l" class="surface-muted px-3 py-2.5 text-center">
          <p class="text-2xs text-ink-400">{{ m.l }}</p>
          <p class="text-sm font-semibold text-ink-800 tabular-nums">{{ m.v }}</p>
        </div>
      </div>

      <!-- 法人 -->
      <div v-if="radar" class="mt-3 surface-muted flex flex-wrap items-center gap-x-5 gap-y-1 p-3 text-sm">
        <span class="font-medium text-ink-600">法人</span>
        <span>外資 <b class="tabular-nums" :class="twPriceClass(radar.foreign_lots)">{{ radar.foreign_lots >= 0 ? '+' : '' }}{{ radar.foreign_lots.toLocaleString() }}</b> 張</span>
        <span>投信 <b class="tabular-nums" :class="twPriceClass(radar.trust_lots)">{{ radar.trust_lots >= 0 ? '+' : '' }}{{ radar.trust_lots.toLocaleString() }}</b> 張</span>
      </div>

      <!-- 基本面 -->
      <div v-if="radar?.fundamentals" class="mt-3 surface-muted p-3 text-sm">
        <div class="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span class="font-medium text-ink-600">基本面</span>
          <span>EPS <b class="text-ink-800">{{ radar.fundamentals.eps ?? '—' }}</b></span>
          <span v-if="radar.deep?.valuation_5y?.pe_now">本益比 <b class="text-ink-800">{{ radar.deep.valuation_5y.pe_now }}</b></span>
          <span v-if="radar.deep?.valuation_5y?.yield_now">殖利率 <b class="text-ink-800">{{ radar.deep.valuation_5y.yield_now }}%</b></span>
          <span>負債比 <b class="text-ink-800">{{ radar.fundamentals.debt_ratio ?? '—' }}%</b></span>
        </div>
        <div v-if="radar.fundamentals.tags?.length" class="mt-2 flex flex-wrap gap-1.5">
          <span v-for="t in radar.fundamentals.tags" :key="t" class="badge-gray">{{ t }}</span>
        </div>
      </div>

      <!-- 資金 -->
      <div v-if="radar?.sentiment" class="mt-3 surface-muted flex flex-wrap items-center gap-x-5 gap-y-1 p-3 text-sm">
        <span class="font-medium text-ink-600">資金</span>
        <span>融資 <b class="text-ink-800 tabular-nums">{{ radar.sentiment.margin_balance?.toLocaleString() ?? '—' }}</b>
          <span class="text-2xs" :class="twPriceClass(radar.sentiment.margin_change_pct)">（{{ (radar.sentiment.margin_change_pct ?? 0) >= 0 ? '+' : '' }}{{ radar.sentiment.margin_change_pct }}%）</span>
        </span>
        <span>券資比 <b class="text-ink-800">{{ radar.sentiment.short_margin_ratio ?? '—' }}%</b></span>
      </div>

      <!-- matched conditions -->
      <div v-if="radar?.matched?.length" class="mt-3 flex flex-wrap gap-1.5">
        <span v-for="(m, i) in radar.matched" :key="i" class="badge-rose">{{ m }}</span>
      </div>
    </div>

    <!-- ===== AI analysis ===== -->
    <div class="border-t border-ink-200 bg-ink-50/50 p-5">
      <div class="mb-3 flex items-center justify-between">
        <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
          <Sparkles class="h-4 w-4" /> AI 完整分析
        </span>
        <span class="flex items-center gap-2">
          <span class="badge" :class="ai.total_score >= 28 ? 'badge-green' : 'badge-gray'">總評 {{ ai.total_score }}/40</span>
          <span class="text-2xs text-ink-400">{{ ai.analyzed_at }}</span>
        </span>
      </div>

      <!-- 8-dimension scores -->
      <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <div v-for="d in DIMS" :key="d.key" v-show="ai.scores[d.key]">
          <div class="mb-1 flex items-center justify-between text-sm">
            <span class="font-medium text-ink-700">{{ d.label }} <span class="text-2xs text-ink-400">{{ ai.scores[d.key]?.score }}/5</span></span>
            <span class="badge-gray">{{ ai.scores[d.key]?.verdict }}</span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full" :class="barColor(ai.scores[d.key]!.score)" :style="{ width: (ai.scores[d.key]!.score / 5) * 100 + '%' }" />
          </div>
          <p class="mt-1 text-xs leading-relaxed text-ink-500" v-html="highlightTerms(ai.scores[d.key]?.note)" />
        </div>
      </div>

      <!-- Bull / bear -->
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div class="surface p-3.5">
          <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-600"><TrendingUp class="h-4 w-4" /> 偏多理由</p>
          <ul class="space-y-1.5">
            <li v-for="(b, i) in ai.bull_case" :key="i" class="flex gap-2 text-sm text-ink-600"><span class="text-emerald-500">•</span>{{ b }}</li>
          </ul>
        </div>
        <div class="surface p-3.5">
          <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-600"><TrendingDown class="h-4 w-4" /> 偏空風險</p>
          <ul class="space-y-1.5">
            <li v-for="(b, i) in ai.bear_case" :key="i" class="flex gap-2 text-sm text-ink-600"><span class="text-rose-500">•</span>{{ b }}</li>
          </ul>
        </div>
      </div>

      <!-- Key metrics -->
      <div v-if="ai.key_metrics?.length" class="mt-3 surface p-3.5">
        <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><Eye class="h-4 w-4 text-brand-500" /> 關鍵觀察指標</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="(m, i) in ai.key_metrics" :key="i" class="badge-gray">{{ m }}</span>
        </div>
      </div>

      <!-- Trade plan -->
      <div v-if="ai.trade_plan" class="mt-3 surface p-3.5">
        <p class="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><Target class="h-4 w-4 text-brand-500" /> 操作參考（非保證進出場點）</p>
        <dl class="grid gap-2 text-sm sm:grid-cols-3">
          <div><dt class="text-2xs text-ink-400">參考買進區間</dt><dd class="text-ink-700">{{ ai.trade_plan.buy_zone }}</dd></div>
          <div><dt class="text-2xs text-ink-400">參考停利</dt><dd class="text-ink-700">{{ ai.trade_plan.take_profit }}</dd></div>
          <div><dt class="text-2xs text-ink-400">參考停損</dt><dd class="text-ink-700">{{ ai.trade_plan.stop_loss }}</dd></div>
        </dl>
        <div v-if="ai.trade_plan.exit_signals?.length" class="mt-3 border-t border-ink-200 pt-2.5">
          <p class="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500"><LogOut class="h-3.5 w-3.5" /> 出場訊號</p>
          <ul class="space-y-1">
            <li v-for="(e, i) in ai.trade_plan.exit_signals" :key="i" class="flex gap-2 text-sm text-ink-600"><span class="text-ink-400">•</span>{{ e }}</li>
          </ul>
        </div>
      </div>

      <!-- Turn bearish -->
      <div v-if="ai.turn_bearish_if?.length" class="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-500/5 p-3">
        <ShieldAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div><p class="text-2xs font-semibold uppercase tracking-wide text-amber-600">看法轉弱條件</p><p class="text-sm text-ink-600">{{ ai.turn_bearish_if.join('、') }}</p></div>
      </div>

      <!-- Long-form detail -->
      <div v-if="ai.detail" class="mt-3">
        <button class="flex w-full items-center justify-between rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100" @click="detailOpen = !detailOpen">
          <span class="flex items-center gap-1.5"><FileText class="h-4 w-4 text-brand-500" /> 展開完整八面向分析</span>
          <ChevronDown class="h-4 w-4 text-ink-400 transition-transform" :class="{ 'rotate-180': detailOpen }" />
        </button>
        <div v-if="detailOpen" class="mt-3 space-y-3">
          <div v-for="d in DETAIL" :key="d.key" v-show="ai.detail?.[d.key]" class="surface p-3.5">
            <p class="eyebrow mb-1.5">{{ d.label }}</p>
            <p class="text-sm leading-relaxed text-ink-600" v-html="highlightTerms(ai.detail?.[d.key])" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
