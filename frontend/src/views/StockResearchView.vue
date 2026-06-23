<script setup lang="ts">
import { ArrowLeft, Activity, ShieldAlert, Gauge, History } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import StatCard from '@/components/ui/StatCard.vue'
import { stockWatchlist } from '@/data/mock'

const riskMeta: Record<string, { label: string; cls: string }> = {
  LOW: { label: '低風險', cls: 'badge-green' },
  MEDIUM: { label: '中風險', cls: 'badge-amber' },
  HIGH: { label: '高風險', cls: 'badge-rose' },
}

const recentAnalysis = [
  { date: '2026-06-24', text: '模型重新評估觀察清單，半導體族群評分上修。' },
  { date: '2026-06-21', text: '加入波動度過濾，降低高風險標的權重。' },
  { date: '2026-06-18', text: '回測 2024–2026 區間，年化模擬報酬僅供參考。' },
]
</script>

<template>
  <div>
    <RouterLink to="/ai" class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
      <ArrowLeft class="h-4 w-4" /> 返回 AI 實驗室
    </RouterLink>

    <PageHeader eyebrow="AI Lab" title="AI 股票研究模型" subtitle="以技術指標與規則為基礎的研究與模擬分析工具。">
      <template #actions>
        <span class="badge-green"><span class="h-1.5 w-1.5 rounded-full bg-current" /> 模型運作中</span>
      </template>
    </PageHeader>

    <!-- Disclaimer -->
    <div class="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <p class="text-sm text-amber-800">
        <span class="font-semibold">免責聲明：</span>本工具僅供研究與模擬分析，不構成投資建議，亦不提供任何下單或交易功能。任何決策請自行評估風險。
      </p>
    </div>

    <!-- Stats -->
    <section class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="觀察標的" :value="stockWatchlist.length" :icon="Activity" sub="目前追蹤" />
      <StatCard label="平均評分" :value="Math.round(stockWatchlist.reduce((s, i) => s + i.score, 0) / stockWatchlist.length)" :icon="Gauge" sub="0–100" />
      <StatCard label="模擬勝率" value="58%" :icon="History" sub="回測 2024–2026" />
      <StatCard label="模型版本" value="v0.3" sub="規則型 + 技術指標" />
    </section>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Watchlist + scores -->
      <SectionCard title="觀察清單與評分" :icon="Activity" class="lg:col-span-2">
        <div class="overflow-hidden rounded-xl border border-ink-100">
          <table class="w-full text-sm">
            <thead class="bg-ink-50 text-ink-500">
              <tr>
                <th class="px-4 py-2.5 text-left font-medium">標的</th>
                <th class="px-4 py-2.5 text-left font-medium">技術訊號</th>
                <th class="px-4 py-2.5 text-left font-medium">風險</th>
                <th class="px-4 py-2.5 text-right font-medium">評分</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100">
              <tr v-for="s in stockWatchlist" :key="s.symbol" class="hover:bg-ink-50/60">
                <td class="px-4 py-3">
                  <span class="font-semibold text-ink-800">{{ s.name }}</span>
                  <span class="ml-1.5 text-2xs text-ink-400">{{ s.symbol }}</span>
                </td>
                <td class="px-4 py-3 text-ink-500">{{ s.signal }}</td>
                <td class="px-4 py-3"><span class="badge" :class="riskMeta[s.risk].cls">{{ riskMeta[s.risk].label }}</span></td>
                <td class="px-4 py-3 text-right">
                  <span class="inline-flex items-center gap-2">
                    <span class="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                      <span class="block h-full rounded-full" :class="s.score >= 75 ? 'bg-emerald-500' : s.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'" :style="{ width: s.score + '%' }" />
                    </span>
                    <span class="w-7 text-right font-semibold text-ink-800">{{ s.score }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <!-- Side: model + recent -->
      <div class="space-y-6">
        <SectionCard title="模型說明">
          <ul class="space-y-2.5 text-sm text-ink-600">
            <li class="flex gap-2"><span class="text-brand-500">•</span> 以均線、量能、波動度等技術指標計算評分</li>
            <li class="flex gap-2"><span class="text-brand-500">•</span> 風險等級依波動度與回檔幅度分級</li>
            <li class="flex gap-2"><span class="text-brand-500">•</span> 回測結果為歷史模擬，不代表未來績效</li>
            <li class="flex gap-2"><span class="text-brand-500">•</span> 不含任何真實下單或交易功能</li>
          </ul>
        </SectionCard>

        <SectionCard title="最近分析紀錄" :icon="History">
          <ul class="space-y-3">
            <li v-for="(r, i) in recentAnalysis" :key="i" class="border-l-2 border-ink-200 pl-3">
              <p class="text-2xs text-ink-400">{{ r.date }}</p>
              <p class="text-sm text-ink-600">{{ r.text }}</p>
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  </div>
</template>
