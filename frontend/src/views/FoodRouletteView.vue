<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Utensils, Plus, X, RotateCcw } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'

const STORAGE_KEY = 'food-roulette-items'

const DEFAULT_ITEMS = [
  '滷肉飯', '牛肉麵', '便當', '火鍋', '拉麵', '水餃',
  '鹹酥雞', '麥當勞', '自助餐', '義大利麵',
]

// Pleasant rotating palette for the wheel slices.
const PALETTE = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
  '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fb7185',
]

const items = ref<string[]>([])
const newItem = ref('')
const rotation = ref(0)
const spinning = ref(false)
const result = ref<string | null>(null)

// ---- persistence (localStorage only — no backend for v1) ----
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    items.value = Array.isArray(parsed) && parsed.length ? parsed : [...DEFAULT_ITEMS]
  } catch {
    items.value = [...DEFAULT_ITEMS]
  }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
  } catch {
    /* ignore quota / private-mode errors */
  }
}
onMounted(load)
watch(items, save, { deep: true })

// ---- wheel geometry (static in the wheel's own frame; the <g> rotates) ----
const CX = 160
const CY = 160
const R = 150
const R_LABEL = 96

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

const segments = computed(() => {
  const n = items.value.length
  if (n === 0) return []
  const seg = 360 / n
  return items.value.map((name, i) => {
    // Angles measured clockwise from 3 o'clock; top (pointer) is -90°.
    const start = -90 + i * seg
    const end = -90 + (i + 1) * seg
    const p0 = polar(start, R)
    const p1 = polar(end, R)
    const largeArc = seg > 180 ? 1 : 0
    const d = `M ${CX} ${CY} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ` +
      `A ${R} ${R} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`

    const mid = start + seg / 2
    const lp = polar(mid, R_LABEL)
    // Flip text on the left half so it never renders upside down.
    let norm = ((mid % 360) + 360) % 360
    const rotate = norm > 90 && norm < 270 ? mid + 180 : mid

    return {
      d,
      color: PALETTE[i % PALETTE.length],
      name,
      labelX: lp.x,
      labelY: lp.y,
      labelRotate: rotate,
      fontSize: n > 14 ? 9 : n > 9 ? 11 : 13,
    }
  })
})

const canSpin = computed(() => items.value.length >= 2 && !spinning.value)

function spin() {
  if (!canSpin.value) return
  spinning.value = true
  result.value = null

  const n = items.value.length
  const seg = 360 / n
  const winner = Math.floor(Math.random() * n)

  // Rotation (mod 360) needed to bring the winner's centre under the top pointer.
  const desiredMod = (((-(winner + 0.5) * seg) % 360) + 360) % 360
  const spins = 4 + Math.floor(Math.random() * 3) // 4–6 full turns
  const base = rotation.value - (((rotation.value % 360) + 360) % 360)
  let next = base + desiredMod
  if (next <= rotation.value) next += 360
  next += spins * 360
  rotation.value = next

  // Settle after the CSS transition; tiny buffer guards against missed events.
  window.setTimeout(() => {
    result.value = items.value[winner]
    spinning.value = false
  }, 4100)
}

function addItem() {
  const v = newItem.value.trim()
  if (!v || items.value.includes(v)) {
    newItem.value = ''
    return
  }
  items.value.push(v)
  newItem.value = ''
}

function removeItem(i: number) {
  items.value.splice(i, 1)
}

function resetItems() {
  items.value = [...DEFAULT_ITEMS]
  result.value = null
}
</script>

<template>
  <PageHeader
    eyebrow="食物輪盤"
    title="今天吃什麼"
    subtitle="不知道吃什麼？轉一下，讓輪盤替你決定。"
  />

  <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
    <!-- Wheel -->
    <div class="card flex flex-col items-center p-6 sm:p-8">
      <div class="relative w-full max-w-sm">
        <!-- Fixed pointer at top -->
        <svg viewBox="0 0 320 320" class="w-full">
          <g
            class="roulette-wheel"
            :style="{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.16, 1, 0.3, 1)' : 'none' }"
          >
            <path
              v-for="(s, i) in segments"
              :key="i"
              :d="s.d"
              :fill="s.color"
              stroke="#fff"
              stroke-width="2"
            />
            <text
              v-for="(s, i) in segments"
              :key="'t' + i"
              :x="s.labelX"
              :y="s.labelY"
              :font-size="s.fontSize"
              fill="#fff"
              font-weight="700"
              text-anchor="middle"
              dominant-baseline="central"
              :transform="`rotate(${s.labelRotate} ${s.labelX} ${s.labelY})`"
            >{{ s.name }}</text>
            <circle :cx="CX" :cy="CY" r="22" fill="#fff" />
            <circle :cx="CX" :cy="CY" r="22" fill="none" stroke="#e4e4e7" stroke-width="2" />
          </g>
          <!-- Pointer (outside the rotating group) -->
          <polygon points="150,4 170,4 160,34" fill="#0f172a" class="dark:fill-white" />
        </svg>
        <Utensils class="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-ink-400" />
      </div>

      <!-- Result -->
      <p class="mb-4 mt-6 h-8 text-center">
        <template v-if="spinning"><span class="text-sm text-ink-500">輪盤轉動中…</span></template>
        <template v-else-if="result">
          <span class="text-lg">🍽 就吃 <span class="font-black text-brand-600">{{ result }}</span> 吧！</span>
        </template>
        <template v-else><span class="text-sm text-ink-400">準備好了就轉吧。</span></template>
      </p>

      <button class="btn-primary gap-2 px-8" :disabled="!canSpin" @click="spin">
        <Utensils class="h-4 w-4" />
        {{ result ? '再轉一次' : '轉！' }}
      </button>
      <p v-if="items.length < 2" class="mt-3 text-xs text-rose-500">至少要有 2 樣食物才能轉。</p>
    </div>

    <!-- Editable list -->
    <div class="card flex flex-col p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-ink-700">食物清單（{{ items.length }}）</h2>
        <button class="text-xs text-ink-400 hover:text-ink-600" @click="resetItems">
          <RotateCcw class="mr-1 inline h-3 w-3" />重置
        </button>
      </div>

      <form class="mb-3 flex gap-2" @submit.prevent="addItem">
        <input
          v-model="newItem"
          type="text"
          maxlength="20"
          placeholder="新增食物…"
          class="input flex-1"
        />
        <button type="submit" class="btn-secondary shrink-0 px-3" :disabled="!newItem.trim()">
          <Plus class="h-4 w-4" />
        </button>
      </form>

      <ul class="space-y-1.5">
        <li
          v-for="(it, i) in items"
          :key="it"
          class="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm dark:bg-white/5"
        >
          <span class="flex items-center gap-2">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: PALETTE[i % PALETTE.length] }" />
            {{ it }}
          </span>
          <button class="text-ink-300 hover:text-rose-500" @click="removeItem(i)">
            <X class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.roulette-wheel {
  transform-box: fill-box;
  transform-origin: center;
}
</style>
