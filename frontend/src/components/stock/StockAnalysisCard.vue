<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, TrendingUp, TrendingDown, Target, ShieldAlert, Eye, LogOut, FileText } from 'lucide-vue-next'
import type { AnalysisStock, ScoreKey } from '@/types/stock'

const props = defineProps<{ stock: AnalysisStock; defaultOpen?: boolean }>()
const open = ref(props.defaultOpen ?? false)
const detailOpen = ref(false)

// Long-form 8-dimension detail (the `detail` object) labels.
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

const DIMS: { key: ScoreKey; label: string }[] = [
  { key: 'fundamental', label: '基本面' },
  { key: 'valuation', label: '估值' },
  { key: 'chips', label: '籌碼' },
  { key: 'technical', label: '技術面' },
  { key: 'industry', label: '產業' },
  { key: 'catalyst', label: '催化劑' },
  { key: 'expectation', label: '預期差' },
  { key: 'risk', label: '風險' },
]

function barColor(score: number) {
  return score >= 4 ? 'bg-emerald-500' : score >= 3 ? 'bg-amber-500' : 'bg-rose-500'
}
function totalCls(total: number) {
  return total >= 28 ? 'badge-green' : total >= 20 ? 'badge-amber' : 'badge-gray'
}
</script>

<template>
  <div class="card overflow-hidden">
    <!-- Header (toggle) -->
    <button class="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-ink-50/60" @click="open = !open">
      <div class="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-ink-200 bg-ink-50">
        <span class="text-base font-bold leading-none text-ink-900">{{ stock.total_score }}</span>
        <span class="text-2xs text-ink-400">/40</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-ink-900">{{ stock.name }}</h3>
          <span class="text-2xs text-ink-400">{{ stock.code }}</span>
          <span class="badge" :class="totalCls(stock.total_score)">
            {{ stock.total_score >= 28 ? 'AI 看好' : stock.total_score >= 20 ? '中性偏多' : '觀察' }}
          </span>
        </div>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <span v-for="d in DIMS.slice(0, 4)" :key="d.key" class="badge-gray">
            {{ d.label }} {{ stock.scores[d.key]?.score ?? '—' }}
          </span>
        </div>
      </div>
      <ChevronDown class="h-5 w-5 shrink-0 text-ink-400 transition-transform" :class="{ 'rotate-180': open }" />
    </button>

    <!-- Body -->
    <Transition name="expand">
      <div v-if="open" class="space-y-5 border-t border-ink-200 p-5">
        <!-- Score grid -->
        <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div v-for="d in DIMS" :key="d.key" v-show="stock.scores[d.key]">
            <div class="mb-1 flex items-center justify-between text-sm">
              <span class="font-medium text-ink-700">{{ d.label }}</span>
              <span class="badge-gray">{{ stock.scores[d.key]?.verdict }} · {{ stock.scores[d.key]?.score }}/5</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
              <div class="h-full rounded-full" :class="barColor(stock.scores[d.key]!.score)"
                :style="{ width: (stock.scores[d.key]!.score / 5) * 100 + '%' }" />
            </div>
            <p class="mt-1 text-xs leading-relaxed text-ink-500">{{ stock.scores[d.key]?.note }}</p>
          </div>
        </div>

        <!-- Bull / Bear -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="surface-muted p-3.5">
            <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <TrendingUp class="h-4 w-4" /> 看多理由
            </p>
            <ul class="space-y-1.5">
              <li v-for="(b, i) in stock.bull_case" :key="i" class="flex gap-2 text-sm text-ink-600">
                <span class="text-emerald-500">•</span>{{ b }}
              </li>
            </ul>
          </div>
          <div class="surface-muted p-3.5">
            <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-600">
              <TrendingDown class="h-4 w-4" /> 看空風險
            </p>
            <ul class="space-y-1.5">
              <li v-for="(b, i) in stock.bear_case" :key="i" class="flex gap-2 text-sm text-ink-600">
                <span class="text-rose-500">•</span>{{ b }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Key metrics -->
        <div v-if="stock.key_metrics?.length" class="surface-muted p-3.5">
          <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            <Eye class="h-4 w-4 text-brand-500" /> 關鍵觀察指標
          </p>
          <ul class="flex flex-wrap gap-1.5">
            <li v-for="(m, i) in stock.key_metrics" :key="i" class="badge-gray">{{ m }}</li>
          </ul>
        </div>

        <!-- Trade plan -->
        <div v-if="stock.trade_plan" class="surface-muted p-3.5">
          <p class="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            <Target class="h-4 w-4 text-brand-500" /> 操作參考（非保證進出場點，僅供研究）
          </p>
          <dl class="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt class="text-2xs text-ink-400">參考買進區間</dt><dd class="text-ink-700">{{ stock.trade_plan.buy_zone }}</dd></div>
            <div><dt class="text-2xs text-ink-400">參考停利</dt><dd class="text-ink-700">{{ stock.trade_plan.take_profit }}</dd></div>
            <div><dt class="text-2xs text-ink-400">參考停損</dt><dd class="text-ink-700">{{ stock.trade_plan.stop_loss }}</dd></div>
          </dl>
          <div v-if="stock.trade_plan.exit_signals?.length" class="mt-3 border-t border-ink-200 pt-2.5">
            <p class="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
              <LogOut class="h-3.5 w-3.5" /> 出場訊號（發生即考慮出場）
            </p>
            <ul class="space-y-1">
              <li v-for="(e, i) in stock.trade_plan.exit_signals" :key="i" class="flex gap-2 text-sm text-ink-600">
                <span class="text-ink-400">•</span>{{ e }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Turn bearish if -->
        <div v-if="stock.turn_bearish_if?.length" class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-500/5 p-3">
          <ShieldAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p class="text-2xs font-semibold uppercase tracking-wide text-amber-600">轉空訊號</p>
            <p class="text-sm text-ink-600">{{ stock.turn_bearish_if.join('、') }}</p>
          </div>
        </div>

        <!-- Full long-form 8-dimension analysis -->
        <div v-if="stock.detail">
          <button class="flex w-full items-center justify-between rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50" @click="detailOpen = !detailOpen">
            <span class="flex items-center gap-1.5"><FileText class="h-4 w-4 text-brand-500" /> 展開完整八面向分析</span>
            <ChevronDown class="h-4 w-4 text-ink-400 transition-transform" :class="{ 'rotate-180': detailOpen }" />
          </button>
          <Transition name="expand">
            <div v-if="detailOpen" class="mt-3 space-y-3">
              <div v-for="d in DETAIL" :key="d.key" v-show="stock.detail?.[d.key]" class="surface-muted p-3.5">
                <p class="eyebrow mb-1.5">{{ d.label }}</p>
                <p class="text-sm leading-relaxed text-ink-600">{{ stock.detail?.[d.key] }}</p>
              </div>
            </div>
          </Transition>
        </div>

        <p class="text-2xs text-ink-400">分析日：{{ stock.analyzed_at }}</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.18s ease;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
}
</style>
