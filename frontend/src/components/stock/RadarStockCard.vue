<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, Users, Building2, Activity } from 'lucide-vue-next'
import type { RadarStock } from '@/types/stock'
import TrendChartCard from '@/components/ui/TrendChartCard.vue'
import { twPriceClass } from '@/utils/format'

const props = defineProps<{ stock: RadarStock; defaultOpen?: boolean }>()
const open = ref(props.defaultOpen ?? false)

const closes = computed(() => props.stock.ohlc?.map((o) => o[4]) ?? [])
const dates = computed(() => props.stock.ohlc?.map((o) => o[0]) ?? [])
const trendUp = computed(() => closes.value.length > 1 && closes.value.at(-1)! >= closes.value[0])
// Taiwan colour: up = red, down = green
const lineColor = computed(() => (trendUp.value ? '#e11d48' : '#059669'))

function maPos(): string {
  const s = props.stock
  if (s.price >= s.ma5 && s.ma5 >= s.ma20 && s.ma20 >= s.ma60) return '多頭排列'
  if (s.price < s.ma60) return '位於季線下'
  return '均線糾結'
}
function compositeCls(v?: number) {
  if (v == null) return 'badge-gray'
  return v >= 70 ? 'badge-rose' : v >= 55 ? 'badge-amber' : 'badge-gray'
}
</script>

<template>
  <div class="card overflow-hidden">
    <button class="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-ink-50/60" @click="open = !open">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-ink-900">{{ stock.name }}</h3>
          <span class="text-2xs text-ink-400">{{ stock.code }}</span>
          <span v-if="stock.composite_score != null" class="badge" :class="compositeCls(stock.composite_score)">
            綜合 {{ stock.composite_score.toFixed(0) }}
          </span>
        </div>
        <div class="mt-1 flex flex-wrap gap-1.5">
          <span v-for="(m, i) in stock.matched.slice(0, 4)" :key="i" class="badge-gray">{{ m }}</span>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <p class="font-semibold text-ink-900 tabular-nums">{{ stock.price }}</p>
        <p class="text-xs font-semibold tabular-nums" :class="twPriceClass(stock.change_pct)">
          {{ stock.change_pct >= 0 ? '+' : '' }}{{ stock.change_pct }}%
        </p>
      </div>
      <ChevronDown class="h-5 w-5 shrink-0 text-ink-400 transition-transform" :class="{ 'rotate-180': open }" />
    </button>

    <Transition name="expand">
      <div v-if="open" class="space-y-4 border-t border-ink-200 p-5">
        <!-- Metrics -->
        <div class="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-4">
          <div><dt class="text-2xs text-ink-400">RSI</dt><dd class="font-medium text-ink-800">{{ stock.rsi }}</dd></div>
          <div><dt class="text-2xs text-ink-400">量比</dt><dd class="font-medium text-ink-800">{{ stock.volume_ratio }}</dd></div>
          <div><dt class="text-2xs text-ink-400">20日報酬</dt><dd class="font-medium tabular-nums" :class="twPriceClass(stock.ret_20d)">{{ stock.ret_20d }}%</dd></div>
          <div><dt class="text-2xs text-ink-400">60日報酬</dt><dd class="font-medium tabular-nums" :class="twPriceClass(stock.ret_60d)">{{ stock.ret_60d }}%</dd></div>
          <div><dt class="text-2xs text-ink-400">外資(張)</dt><dd class="font-medium tabular-nums" :class="twPriceClass(stock.foreign_lots)">{{ stock.foreign_lots.toLocaleString() }}</dd></div>
          <div><dt class="text-2xs text-ink-400">投信(張)</dt><dd class="font-medium tabular-nums" :class="twPriceClass(stock.trust_lots)">{{ stock.trust_lots.toLocaleString() }}</dd></div>
          <div><dt class="text-2xs text-ink-400">RS20</dt><dd class="font-medium text-ink-800">{{ stock.rs_20d }}</dd></div>
          <div><dt class="text-2xs text-ink-400">均線</dt><dd class="font-medium text-ink-800">{{ maPos() }}</dd></div>
        </div>

        <!-- Chips + industry -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-if="stock.chip" class="surface-muted p-3.5">
            <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><Users class="h-4 w-4 text-brand-500" /> 籌碼（集保大戶）</p>
            <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-600">
              <span>千張大戶 <b class="text-ink-800">{{ stock.chip.big1000_pct ?? '—' }}%</b></span>
              <span>散戶 <b class="text-ink-800">{{ stock.chip.retail_pct ?? '—' }}%</b></span>
              <span class="text-2xs text-ink-400">{{ stock.chip.trend }}</span>
            </div>
          </div>
          <div v-if="stock.industry" class="surface-muted p-3.5">
            <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><Building2 class="h-4 w-4 text-brand-500" /> 產業</p>
            <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-600">
              <span class="text-ink-800">{{ stock.industry.name }}</span>
              <span>族群排名 <b class="text-ink-800">{{ stock.industry.rank }}/{{ stock.industry.total }}</b></span>
              <span class="badge-gray">{{ stock.industry.strength }}</span>
            </div>
          </div>
        </div>

        <!-- Price trend -->
        <div v-if="closes.length">
          <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><Activity class="h-4 w-4 text-brand-500" /> 近期走勢</p>
          <TrendChartCard title="" :labels="dates" :data="closes" :color="lineColor" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active { transition: opacity 0.18s ease; }
.expand-enter-from,
.expand-leave-to { opacity: 0; }
</style>
