<script setup lang="ts">
import { computed } from 'vue'
import type { TrackDetail } from '@/types/stock'
import { twPriceClass } from '@/utils/format'

const props = defineProps<{ rows: TrackDetail[]; windows: number[] }>()

const sorted = computed(() => [...props.rows].sort((a, b) => (a.date < b.date ? 1 : -1)))

function currentPrice(r: TrackDetail): number | null {
  if (r.last_return_pct == null) return null
  return r.entry_price * (1 + r.last_return_pct / 100)
}
function maxGain(r: TrackDetail): number | null {
  const vals = Object.values(r.windows)
    .map((w) => w.max_return_pct)
    .filter((v): v is number => v != null)
  return vals.length ? Math.max(...vals) : null
}
</script>

<template>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto scrollbar-thin">
      <table class="w-full min-w-[760px] text-sm">
        <thead class="border-b border-ink-200 bg-ink-50 text-ink-500">
          <tr>
            <th class="px-4 py-3 text-left font-medium">預判日</th>
            <th class="px-4 py-3 text-left font-medium">代號 / 名稱</th>
            <th class="px-4 py-3 text-right font-medium">AI 評分</th>
            <th class="px-4 py-3 text-right font-medium">進場</th>
            <th class="px-4 py-3 text-right font-medium">目前</th>
            <th class="px-4 py-3 text-right font-medium">最大漲幅</th>
            <th v-for="w in windows" :key="w" class="px-3 py-3 text-center font-medium">{{ w }} 日</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink-100">
          <tr v-for="r in sorted" :key="r.code + r.date" class="transition-colors hover:bg-ink-50/60">
            <td class="whitespace-nowrap px-4 py-3 text-ink-500">{{ r.date }}</td>
            <td class="whitespace-nowrap px-4 py-3">
              <span class="font-semibold text-ink-800">{{ r.name }}</span>
              <span class="ml-1.5 text-2xs text-ink-400">{{ r.code }}</span>
            </td>
            <td class="px-4 py-3 text-right">
              <span class="font-bold" :class="r.total_score >= 28 ? 'text-emerald-600' : 'text-ink-700'">
                {{ r.total_score }}</span><span class="text-2xs text-ink-400">/40</span>
            </td>
            <td class="px-4 py-3 text-right tabular-nums text-ink-600">{{ r.entry_price.toFixed(2) }}</td>
            <td class="px-4 py-3 text-right tabular-nums">
              <template v-if="currentPrice(r) != null">
                <span class="text-ink-800">{{ currentPrice(r)!.toFixed(2) }}</span>
                <span class="ml-1 text-2xs font-semibold" :class="twPriceClass(r.last_return_pct)">
                  ({{ (r.last_return_pct ?? 0) >= 0 ? '+' : '' }}{{ r.last_return_pct?.toFixed(1) }}%)
                </span>
              </template>
              <span v-else class="text-ink-300">—</span>
            </td>
            <td class="px-4 py-3 text-right">
              <span v-if="maxGain(r) != null" class="font-semibold text-rose-600">
                +{{ maxGain(r)!.toFixed(1) }}%
              </span>
              <span v-else class="text-ink-300">—</span>
            </td>
            <td v-for="w in windows" :key="w" class="px-3 py-3 text-center">
              <template v-if="r.windows[String(w)]">
                <span v-if="r.windows[String(w)].hit" class="badge-rose">
                  命中 {{ r.windows[String(w)].days_to_hit }}d
                </span>
                <span v-else class="badge-amber">進行中</span>
              </template>
              <span v-else class="text-ink-300">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
