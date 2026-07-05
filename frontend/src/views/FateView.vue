<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
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

// ---- 3D die ----------------------------------------------------------
// A real CSS cube: 3 YES faces + 3 NO faces. To land on a face we rotate the
// cube to that face's inverse orientation, plus a few full 360° tumbles.
interface DieFace { label: Face; rx: number; ry: number }
const FACES: DieFace[] = [
  { label: 'YES', rx: 0, ry: 0 },      // front
  { label: 'NO', rx: 0, ry: 180 },     // back
  { label: 'NO', rx: 0, ry: -90 },     // right
  { label: 'YES', rx: 0, ry: 90 },     // left
  { label: 'YES', rx: -90, ry: 0 },    // top
  { label: 'NO', rx: 90, ry: 0 },      // bottom
]

// Running rotation totals so every roll keeps spinning the same direction.
const rotX = ref(-18)
const rotY = ref(32)
const cubeStyle = computed(() => ({
  transform: `rotateX(${rotX.value}deg) rotateY(${rotY.value}deg)`,
}))

let settleTimer: ReturnType<typeof setTimeout> | null = null

async function roll() {
  if (rolling.value) return
  rolling.value = true
  result.value = null

  // Pick the winning face, then aim the cube at it with extra full tumbles.
  const face = FACES[Math.floor(Math.random() * FACES.length)]
  const spinsX = 360 * (2 + Math.floor(Math.random() * 2))
  const spinsY = 360 * (2 + Math.floor(Math.random() * 2))

  // Let the .is-rolling transition class land in its own frame first —
  // changing class + transform together makes the browser skip the transition
  // (the cube would teleport to the result instead of tumbling). setTimeout
  // instead of rAF so it also fires in background tabs.
  await nextTick()
  setTimeout(() => {
    rotX.value = rotX.value - (rotX.value % 360) + spinsX + face.rx
    rotY.value = rotY.value - (rotY.value % 360) + spinsY + face.ry
  }, 50)

  settleTimer = setTimeout(() => {
    result.value = face.label
    rolling.value = false
    history.value.unshift({
      result: face.label,
      at: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    })
    if (history.value.length > 12) history.value = history.value.slice(0, 12)
  }, 1750)
}

function reset() {
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = null
  rolling.value = false
  result.value = null
  history.value = []
}
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

      <!-- The 3D die -->
      <div class="fate-scene mb-8 select-none">
        <div class="fate-bouncer" :class="{ 'is-rolling': rolling }">
          <div
            class="fate-cube"
            :class="{ 'is-idle': !rolling && result === null, 'is-rolling': rolling }"
            :style="cubeStyle"
          >
            <div
              v-for="(f, i) in FACES" :key="i"
              class="fate-face" :class="f.label === 'YES' ? 'is-yes' : 'is-no'"
              :style="{ transform: `rotateY(${-f.ry}deg) rotateX(${-f.rx}deg) translateZ(var(--half))` }"
            >
              <component :is="f.label === 'YES' ? Check : X" class="h-10 w-10" :stroke-width="3" />
              <span class="text-xl font-black tracking-widest">{{ f.label }}</span>
              <span class="fate-face-gloss" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div class="fate-shadow" :class="{ 'is-rolling': rolling }" aria-hidden="true" />
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
/* ---- 3D die scene ---- */
.fate-scene {
  --size: 10.5rem;
  --half: calc(var(--size) / 2);
  position: relative;
  width: var(--size);
  height: calc(var(--size) + 2.5rem);
  perspective: 900px;
  perspective-origin: 50% 30%;
}
.fate-bouncer {
  width: var(--size);
  height: var(--size);
  transform-style: preserve-3d;
}
.fate-bouncer.is-rolling {
  animation: fate-bounce 1.65s cubic-bezier(0.3, 0.6, 0.4, 1);
}
@keyframes fate-bounce {
  0% { transform: translateY(0); }
  18% { transform: translateY(-3.4rem); }
  42% { transform: translateY(0.2rem); }
  58% { transform: translateY(-1.6rem); }
  74% { transform: translateY(0.15rem); }
  86% { transform: translateY(-0.5rem); }
  100% { transform: translateY(0); }
}
.fate-cube {
  position: relative;
  width: var(--size);
  height: var(--size);
  transform-style: preserve-3d;
}
.fate-cube.is-rolling {
  transition: transform 1.65s cubic-bezier(0.16, 0.84, 0.32, 1.02);
}
.fate-cube.is-idle {
  animation: fate-idle 9s linear infinite;
}
@keyframes fate-idle {
  from { transform: rotateX(-18deg) rotateY(32deg); }
  to { transform: rotateX(-18deg) rotateY(392deg); }
}
@media (prefers-reduced-motion: reduce) {
  .fate-cube.is-idle { animation: none; }
  .fate-bouncer.is-rolling { animation: none; }
  .fate-cube.is-rolling { transition-duration: 0.3s; }
}
.fate-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border-radius: 1.4rem;
  color: #fff;
  backface-visibility: hidden;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.28), inset 0 -1.6rem 2.4rem rgba(0, 0, 0, 0.28);
  overflow: hidden;
}
.fate-face.is-yes {
  background:
    radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.38), transparent 46%),
    linear-gradient(135deg, #34d399, #059669 55%, #036c4e);
}
.fate-face.is-no {
  background:
    radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.36), transparent 46%),
    linear-gradient(135deg, #fb7185, #e11d48 55%, #9f1136);
}
.fate-face-gloss {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.3) 0%, transparent 38%);
  pointer-events: none;
}
/* floor shadow */
.fate-shadow {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: calc(var(--size) * 0.9);
  height: 1.1rem;
  transform: translateX(-50%);
  border-radius: 9999px;
  background: radial-gradient(closest-side, rgba(10, 10, 30, 0.45), transparent);
  filter: blur(4px);
}
.fate-shadow.is-rolling {
  animation: fate-shadow 1.65s cubic-bezier(0.3, 0.6, 0.4, 1);
}
@keyframes fate-shadow {
  0% { transform: translateX(-50%) scale(1); opacity: 1; }
  18% { transform: translateX(-50%) scale(0.55); opacity: 0.5; }
  42% { transform: translateX(-50%) scale(1.05); opacity: 1; }
  58% { transform: translateX(-50%) scale(0.72); opacity: 0.65; }
  74% { transform: translateX(-50%) scale(1.03); opacity: 1; }
  100% { transform: translateX(-50%) scale(1); opacity: 1; }
}
</style>
