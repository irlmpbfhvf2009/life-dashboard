<script setup lang="ts">
import { ref } from 'vue'
import { Camera, Send, Loader2, Salad, AlertCircle } from 'lucide-vue-next'
import { aiApi } from '@/api'
import { useHealthStore } from '@/composables/useHealthStore'
import { useColdStartHint } from '@/composables/useColdStartHint'
import type { FoodEntry, HealthProfile } from '@/data/health'

const props = defineProps<{ profile: HealthProfile; aiEnabled: boolean; visionOk: boolean }>()
const emit = defineEmits<{ logged: [] }>()
const store = useHealthStore()

const draft = ref('')
const analyzing = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const { active: slow, start: startSlowTimer, stop: stopSlowTimer } = useColdStartHint()

function nowHm() {
  return new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}

async function submitText() {
  const text = draft.value.trim()
  if (!text || analyzing.value) return
  await analyze({ text })
}

function pickPhoto() {
  error.value = ''
  fileInput.value?.click()
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = '' // allow re-selecting the same file
  if (!file || analyzing.value) return
  const { fileToCompressedBase64 } = await import('@/utils/image')
  try {
    const { base64, mimeType } = await fileToCompressedBase64(file)
    await analyze({ text: draft.value.trim() || undefined, image: base64, mimeType })
  } catch {
    error.value = '照片讀取失敗，請再試一次'
  }
}

async function analyze(body: { text?: string; image?: string; mimeType?: string }) {
  analyzing.value = true
  error.value = ''
  startSlowTimer()
  try {
    const r = await aiApi.nutrition({ ...body, weightKg: props.profile.weightKg })
    const entry: FoodEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: nowHm(),
      kind: r.kind,
      label: r.label,
      calories: Math.round(r.calories),
      protein: Math.round(r.protein),
      fiber: Math.round(r.fiber),
      carbs: Math.round(r.carbs),
      fat: Math.round(r.fat),
      keyNutrients: r.keyNutrients ?? [],
      note: r.note ?? '',
    }
    store.update((d) => {
      d.log.entries.push(entry)
      d.log.review = null // totals changed → old verdict is stale
    })
    draft.value = ''
    emit('logged')
  } catch (err: unknown) {
    error.value = describeAiError(err, 'AI 分析失敗，請描述再具體一點或稍後再試')
  } finally {
    analyzing.value = false
    stopSlowTimer()
  }
}

// The response interceptor rethrows a plain Error (status is stripped) but keeps
// the backend's message, so we detect "AI not configured" from the text.
function describeAiError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : ''
  if (/GEMINI|尚未設定|尚未啟用/.test(msg)) {
    return 'AI 尚未啟用——請到「設定」頁填入你的金鑰。'
  }
  // A raw browser-level timeout/CORS failure (no backend message reached us) —
  // most often the AI call just took too long. Give the user something actionable.
  if (/network error|timeout/i.test(msg)) {
    return 'AI 回應時間過長或網路不穩，請稍後再試一次（描述簡短一點、照片小一點會更快）。'
  }
  return msg || fallback
}
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-3 flex items-center gap-2.5">
      <span class="chip-cute h-8 w-8 bg-lime-500/10 text-lime-600"><Salad class="h-4 w-4" :stroke-width="2" /></span>
      <div>
        <h3 class="section-title">今日營養</h3>
        <p class="text-2xs text-ink-400">打字或拍照記錄每一餐 / 運動，AI 幫你算營養</p>
      </div>
    </header>

    <div v-if="!aiEnabled" class="mb-3 flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
      <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
      <span>AI 營養分析尚未啟用——請到<b>「設定」</b>頁填入你自己的 Gemini 金鑰即可使用（免費）。</span>
    </div>

    <textarea
      v-model="draft"
      rows="2"
      :disabled="analyzing"
      placeholder="例如：午餐一碗牛肉麵加燙青菜、或 健身房重訓 90 分鐘（扣掉休息）"
      class="input resize-none"
      @keydown.enter.exact.prevent="submitText"
    />
    <div class="mt-2.5 flex items-center gap-2">
      <button v-if="visionOk" class="btn-secondary btn-sm gap-1.5" :disabled="analyzing" @click="pickPhoto">
        <Camera class="h-4 w-4" /> 拍照 / 上傳
      </button>
      <button class="btn-primary btn-sm ml-auto gap-1.5" :disabled="analyzing || !draft.trim()" @click="submitText">
        <Loader2 v-if="analyzing" class="h-4 w-4 animate-spin" />
        <Send v-else class="h-4 w-4" />
        {{ analyzing ? (slow ? '啟動中…' : 'AI 分析中…') : '記錄' }}
      </button>
    </div>
    <input ref="fileInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onFile" />

    <p v-if="slow" class="mt-2 text-xs text-ink-400">伺服器閒置一陣子後會休眠，喚醒可能需要 20〜30 秒，請稍候…</p>
    <p v-if="error" class="mt-2 text-xs text-rose-500">{{ error }}</p>
  </section>
</template>
