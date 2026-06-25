<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dices, RotateCcw, Check, X } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'

type Face = 'YES' | 'NO'

interface HistoryEntry {
  result: Face
  at: string
}

const question = ref('')
const result = ref<Face | null>(null)
const rolling = ref(false)
const history = ref<HistoryEntry[]>([])

const yesCount = computed(() => history.value.filter((h) => h.result === 'YES').length)
const noCount = computed(() => history.value.filter((h) => h.result === 'NO').length)

let rollTimer: ReturnType<typeof setInterval> | null = null
let settleTimer: ReturnType<typeof setTimeout> | null = null

function roll() {
  if (rolling.value) return
  rolling.value = true
  result.value = null

  // Flicker between faces while "rolling" for tactile feedback.
  rollTimer = setInterval(() => {
    result.value = Math.random() < 0.5 ? 'YES' : 'NO'
  }, 80)

  settleTimer = setTimeout(() => {
    if (rollTimer) clearInterval(rollTimer)
    rollTimer = null
    const final: Face = Math.random() < 0.5 ? 'YES' : 'NO'
    result.value = final
    rolling.value = false
    history.value.unshift({
      result: final,
      at: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    })
    if (history.value.length > 12) history.value = history.value.slice(0, 12)
  }, 900)
}

function reset() {
  if (rollTimer) clearInterval(rollTimer)
  if (settleTimer) clearTimeout(settleTimer)
  rollTimer = null
  settleTimer = null
  rolling.value = false
  result.value = null
  history.value = []
}

const faceClass = computed(() => {
  if (!result.value) return 'is-idle'
  return result.value === 'YES' ? 'is-yes' : 'is-no'
})
</script>

<template>
  <PageHeader
    eyebrow="命運"
    title="YES / NO 擲骰"
    subtitle="心裡想著一個問題，讓骰子替你決定。"
  />

  <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
    <!-- Main oracle -->
    <div class="card flex flex-col items-center p-8">
      <!-- Optional question -->
      <input
        v-model="question"
        type="text"
        maxlength="60"
        placeholder="（選填）寫下你的問題…"
        class="input mb-8 w-full max-w-md text-center"
      />

      <!-- The die -->
      <div
        class="fate-die mb-8 flex h-44 w-44 select-none items-center justify-center rounded-[2rem] shadow-card transition-transform"
        :class="[faceClass, { 'fate-die--rolling': rolling }]"
      >
        <Dices v-if="result === null" class="h-16 w-16 opacity-40" />
        <div v-else class="flex flex-col items-center gap-1">
          <component :is="result === 'YES' ? Check : X" class="h-12 w-12" :stroke-width="2.5" />
          <span class="text-3xl font-black tracking-wide">{{ result }}</span>
        </div>
      </div>

      <!-- Verdict line -->
      <p class="mb-6 h-6 text-center text-sm text-ink-500">
        <template v-if="rolling">命運正在決定…</template>
        <template v-else-if="result === 'YES'">骰子說：<span class="font-bold text-emerald-500">就去做吧 ✅</span></template>
        <template v-else-if="result === 'NO'">骰子說：<span class="font-bold text-rose-500">先別 ❌</span></template>
        <template v-else>準備好了就擲骰。</template>
      </p>

      <div class="flex items-center gap-3">
        <button class="btn-primary gap-2" :disabled="rolling" @click="roll">
          <Dices class="h-4 w-4" />
          {{ result === null ? '擲骰' : '再擲一次' }}
        </button>
        <button
          v-if="history.length"
          class="btn-secondary gap-2"
          :disabled="rolling"
          @click="reset"
        >
          <RotateCcw class="h-4 w-4" />
          清除
        </button>
      </div>
    </div>

    <!-- Side: tally + history -->
    <div class="flex flex-col gap-6">
      <div class="card p-5">
        <h2 class="mb-4 text-sm font-semibold text-ink-700">本次統計</h2>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/10">
            <p class="text-2xl font-black text-emerald-500">{{ yesCount }}</p>
            <p class="mt-0.5 text-xs font-semibold text-ink-500">YES</p>
          </div>
          <div class="rounded-2xl bg-rose-50 p-4 text-center dark:bg-rose-500/10">
            <p class="text-2xl font-black text-rose-500">{{ noCount }}</p>
            <p class="mt-0.5 text-xs font-semibold text-ink-500">NO</p>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <h2 class="mb-4 text-sm font-semibold text-ink-700">歷史紀錄</h2>
        <ul v-if="history.length" class="space-y-2">
          <li
            v-for="(h, i) in history"
            :key="i"
            class="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm dark:bg-white/5"
          >
            <span
              class="inline-flex items-center gap-1.5 font-bold"
              :class="h.result === 'YES' ? 'text-emerald-500' : 'text-rose-500'"
            >
              <component :is="h.result === 'YES' ? Check : X" class="h-4 w-4" />
              {{ h.result }}
            </span>
            <span class="text-xs text-ink-400">{{ h.at }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-ink-400">還沒有紀錄，擲一次看看。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fate-die {
  background: var(--surface-2, #f4f4f5);
  color: var(--ink-400, #a1a1aa);
}
.fate-die.is-yes {
  background: linear-gradient(135deg, #34d399, #059669);
  color: #fff;
}
.fate-die.is-no {
  background: linear-gradient(135deg, #fb7185, #e11d48);
  color: #fff;
}
.fate-die--rolling {
  animation: fate-shake 0.18s ease-in-out infinite;
}
@keyframes fate-shake {
  0%, 100% { transform: rotate(-6deg) scale(1.02); }
  50% { transform: rotate(6deg) scale(1.05); }
}
</style>
