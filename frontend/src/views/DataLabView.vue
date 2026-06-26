<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Bar } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import '@/components/charts/registerCharts'
import { UploadCloud, FileSpreadsheet, Sparkles, Wand2, TrendingUp, Lightbulb, Table2, Hash, Type } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { theme } = useTheme()
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import { aiApi, type DataInsight } from '@/api'
import { parseCsv, profileColumns, buildProfile, type ColumnStat } from '@/utils/csv'

const enabled = ref<boolean | null>(null)
const fileName = ref('')
const headers = ref<string[]>([])
const rows = ref<string[][]>([])
const stats = ref<ColumnStat[]>([])
const parseError = ref('')

const analyzing = ref(false)
const insight = ref<DataInsight | null>(null)
const aiError = ref('')

onMounted(async () => {
  try { enabled.value = (await aiApi.status()).enabled } catch { enabled.value = false }
})

function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  reset()
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = parseCsv(String(reader.result))
      if (!parsed.headers.length || !parsed.rows.length) {
        parseError.value = '無法解析這個檔案，請確認是有標題列的 CSV。'
        return
      }
      headers.value = parsed.headers
      rows.value = parsed.rows
      stats.value = profileColumns(parsed.headers, parsed.rows)
    } catch {
      parseError.value = '解析失敗，請確認檔案格式。'
    }
  }
  reader.readAsText(file)
}

function reset() {
  headers.value = []; rows.value = []; stats.value = []
  insight.value = null; parseError.value = ''; aiError.value = ''
}

const numericCols = computed(() => stats.value.filter((s) => s.type === 'number'))
const previewRows = computed(() => rows.value.slice(0, 10))

// Quick bar chart of the first numeric column (first 40 values).
const chartCol = computed(() => numericCols.value[0])
const chartData = computed<ChartData<'bar'>>(() => {
  const col = chartCol.value
  if (!col) return { labels: [], datasets: [] }
  const idx = headers.value.indexOf(col.name)
  const vals = rows.value.slice(0, 40).map((r) => Number(r[idx])).filter((n) => Number.isFinite(n))
  return {
    labels: vals.map((_, i) => String(i + 1)),
    datasets: [{ data: vals, backgroundColor: '#6366f1', borderRadius: 3 }],
  }
})
const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { x: { display: false }, y: { grid: { display: false }, ticks: { color: theme.value === 'dark' ? '#94a3b8' : '#64748b', font: { size: 10 } } } },
}))

async function analyze() {
  if (!headers.value.length || analyzing.value) return
  analyzing.value = true
  aiError.value = ''
  insight.value = null
  try {
    const profile = buildProfile(headers.value, rows.value, stats.value)
    insight.value = await aiApi.dataLabAnalyze({ profile })
  } catch (e) {
    aiError.value = e instanceof Error ? e.message : String(e)
  } finally {
    analyzing.value = false
  }
}

const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
</script>

<template>
  <PageHeader :icon="Wand2" eyebrow="AI Lab" title="資料分析工具" subtitle="上傳 CSV，自動產生欄位統計與圖表，再讓 AI 給你白話洞察與下一步建議。">
    <template #actions>
      <label class="btn-primary btn-sm cursor-pointer gap-1.5">
        <UploadCloud class="h-3.5 w-3.5" /> 上傳 CSV
        <input type="file" accept=".csv,text/csv" class="hidden" @change="onFile" />
      </label>
    </template>
  </PageHeader>

  <div v-if="enabled === false" class="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
    <Sparkles class="mt-0.5 h-4 w-4 shrink-0" /> AI 洞察尚未啟用（後端缺少 GEMINI_API_KEY）。檔案解析、統計與圖表仍可正常使用。
  </div>

  <!-- Empty / upload prompt -->
  <SectionCard v-if="!headers.length">
    <label class="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ink-200 py-14 text-center transition-colors hover:border-brand-300">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
        <FileSpreadsheet class="h-6 w-6" :stroke-width="1.75" />
      </div>
      <div>
        <p class="text-sm font-semibold text-ink-700">拖放或點擊上傳 CSV</p>
        <p class="mt-1 text-xs text-ink-400">檔案只在你的瀏覽器解析，不會上傳原始資料。</p>
      </div>
      <input type="file" accept=".csv,text/csv" class="hidden" @change="onFile" />
    </label>
    <p v-if="parseError" class="mt-3 text-center text-sm text-rose-600">{{ parseError }}</p>
  </SectionCard>

  <template v-else>
    <!-- Overview -->
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <span class="inline-flex items-center gap-1.5 rounded-xl bg-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700">
        <FileSpreadsheet class="h-4 w-4 text-ink-400" /> {{ fileName }}
      </span>
      <span class="text-sm text-ink-500">{{ rows.length }} 列 × {{ headers.length }} 欄</span>
      <button class="btn-secondary btn-sm ml-auto" @click="reset">清除</button>
    </div>

    <!-- Column stats -->
    <SectionCard :icon="Table2" title="欄位摘要" class="mb-6">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="s in stats" :key="s.name" class="rounded-2xl border border-ink-100 p-3.5">
          <div class="mb-1.5 flex items-center gap-1.5">
            <component :is="s.type === 'number' ? Hash : Type" class="h-3.5 w-3.5 text-ink-400" />
            <span class="truncate text-sm font-semibold text-ink-800">{{ s.name }}</span>
            <span class="badge" :class="s.type === 'number' ? 'badge-brand' : 'badge-gray'">{{ s.type === 'number' ? '數值' : '文字' }}</span>
          </div>
          <div v-if="s.type === 'number'" class="grid grid-cols-3 gap-1 text-xs text-ink-500">
            <span>最小 {{ round(s.min!) }}</span><span>最大 {{ round(s.max!) }}</span><span>平均 {{ round(s.mean!) }}</span>
          </div>
          <div v-else class="text-xs text-ink-500">{{ s.unique }} 種不同值</div>
          <p v-if="s.missing" class="mt-1 text-xs text-amber-600">{{ s.missing }} 筆缺值</p>
        </div>
      </div>
    </SectionCard>

    <div class="mb-6 grid gap-4 lg:grid-cols-2">
      <!-- Chart -->
      <SectionCard v-if="chartCol" :icon="TrendingUp" :title="`${chartCol.name}（前 40 筆）`">
        <div class="h-48"><Bar :data="chartData" :options="chartOptions" /></div>
      </SectionCard>

      <!-- Table preview -->
      <SectionCard :icon="Table2" title="資料預覽">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-ink-100 text-ink-400">
                <th v-for="h in headers" :key="h" class="whitespace-nowrap px-2 py-1.5 font-medium">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in previewRows" :key="i" class="border-b border-ink-50">
                <td v-for="(c, j) in r" :key="j" class="whitespace-nowrap px-2 py-1.5 text-ink-600">{{ c }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>

    <!-- AI insights -->
    <SectionCard :icon="Sparkles" title="AI 洞察">
      <template #action>
        <button class="btn-primary btn-sm gap-1.5" :disabled="analyzing" @click="analyze">
          <Wand2 class="h-3.5 w-3.5" /> {{ analyzing ? '分析中…' : '產生洞察' }}
        </button>
      </template>

      <div v-if="analyzing" class="flex items-center gap-2 py-8 text-sm text-ink-400">
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" />
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay:150ms" />
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay:300ms" /> AI 正在分析你的資料…
      </div>
      <p v-else-if="aiError" class="py-6 text-center text-sm text-rose-600">{{ aiError }}</p>
      <p v-else-if="!insight" class="py-6 text-center text-sm text-ink-400">點「產生洞察」讓 AI 解讀這份資料。</p>

      <div v-else class="space-y-5">
        <p class="rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">{{ insight.summary }}</p>

        <section v-if="insight.findings.length">
          <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><TrendingUp class="h-4 w-4 text-emerald-500" /> 發現</p>
          <ul class="space-y-1.5">
            <li v-for="(f, i) in insight.findings" :key="i" class="flex items-start gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">
              <span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600">{{ i + 1 }}</span>{{ f }}
            </li>
          </ul>
        </section>

        <section v-if="insight.suggestions.length">
          <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700"><Lightbulb class="h-4 w-4 text-amber-500" /> 建議下一步</p>
          <ul class="space-y-1.5">
            <li v-for="(s, i) in insight.suggestions" :key="i" class="rounded-xl border border-ink-100 px-3 py-2 text-sm text-ink-600">{{ s }}</li>
          </ul>
        </section>
      </div>
    </SectionCard>
  </template>
</template>
