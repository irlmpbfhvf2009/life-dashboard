<script setup lang="ts">
// 遊戲娛樂城 — the arcade now lives inside the studio (娛樂 > 遊戲) instead of
// the old standalone /play portal. Two categories: 電子 (Horus tumble slot) and
// 捕魚 (深海獵金 fish hunter).
import { ref, onMounted } from 'vue'
import { Coins, Gamepad2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useWallet } from '@/composables/useWallet'
import { userApi } from '@/api'
import Seth2Slot from '@/components/casino/Seth2Slot.vue'
import Seth2Symbol from '@/components/casino/Seth2Symbol.vue'
import FishHunter from '@/components/casino/FishHunter.vue'
import { SPECIES } from '@/components/casino/fish/art'

const auth = useAuthStore()
const { coins, refresh } = useWallet()

const CATEGORIES = [
  { key: 'electronic', label: '電子', emoji: '🎰' },
  { key: 'fishing', label: '捕魚', emoji: '🐟' },
]
const activeCat = ref('electronic')
const openGame = ref<'horus' | 'fish' | null>(null)

// tiny animated preview for the fish card
const fishCardCanvas = ref<HTMLCanvasElement | null>(null)
let fishRaf = 0
function drawFishCard() {
  const c = fishCardCanvas.value
  if (!c) { if (fishRaf) { cancelAnimationFrame(fishRaf); fishRaf = 0 } return }
  const g = c.getContext('2d')!
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (c.width !== c.clientWidth * dpr) { c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr }
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, c.clientWidth, c.clientHeight)
  const now = performance.now() / 1000
  g.save()
  g.translate(c.clientWidth / 2, c.clientHeight / 2 + Math.sin(now * 1.4) * 4)
  SPECIES[13].draw(g, Math.min(c.clientWidth * 0.8, 120), now) // golden shark
  g.restore()
  fishRaf = requestAnimationFrame(drawFishCard)
}

onMounted(async () => {
  if (!auth.isAuthenticated) return
  // Self-serve: the arcade used to grant the player role at its own signup.
  // Now grant it (idempotent) the first time a studio user opens the arcade.
  if (!auth.isPlayer) {
    try {
      auth.profile = await userApi.source('game')
    } catch { /* keep going — spins will surface the error if it really failed */ }
  }
  refresh()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg">
          <Gamepad2 class="h-5 w-5" />
        </span>
        <div>
          <h2 class="text-lg font-bold text-ink-900">遊戲娛樂城</h2>
          <p class="text-xs text-ink-400">虛擬遊戲幣 · 伺服器結算 · 純娛樂練習</p>
        </div>
      </div>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-sm font-bold text-[#1c0f06] shadow">
        <Coins class="h-4 w-4" /> {{ coins.toLocaleString() }}
      </span>
    </div>

    <!-- A game is open: play it full-width -->
    <div v-if="openGame === 'horus'" class="mx-auto max-w-xl">
      <Seth2Slot @back="openGame = null" />
    </div>
    <div v-else-if="openGame === 'fish'" class="mx-auto max-w-5xl">
      <FishHunter @back="openGame = null" />
    </div>

    <template v-else>
      <!-- Jackpot banner -->
      <div class="mb-4 flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-[#1b2a4a] via-[#22386a] to-[#1b2a4a] py-6 ring-1 ring-amber-400/25">
        <p class="text-xs text-amber-300/80">獎池累積</p>
        <p class="font-mono text-3xl font-black tracking-widest text-amber-300">30,245,457</p>
      </div>

      <!-- Category tabs -->
      <div class="mb-4 flex gap-2">
        <button
          v-for="c in CATEGORIES" :key="c.key"
          class="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors"
          :class="activeCat === c.key
            ? 'bg-gradient-to-r from-brand-500 to-violet-600 text-white shadow-glow'
            : 'bg-ink-100 text-ink-500 hover:text-ink-700'"
          @click="activeCat = c.key"
        >
          <span>{{ c.emoji }}</span>{{ c.label }}
        </button>
      </div>

      <!-- 電子 -->
      <div v-if="activeCat === 'electronic'" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <button
          class="group relative col-span-2 flex aspect-[2/1] flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#5a1a10] via-[#3a1208] to-[#140602] text-center ring-1 ring-amber-400/50 transition hover:ring-amber-300 hover:shadow-[0_0_24px_rgba(255,190,60,0.25)] sm:col-span-1 sm:aspect-[4/3]"
          @click="openGame = 'horus'"
        >
          <span class="absolute right-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">HOT</span>
          <span class="block h-12 w-12 drop-shadow-[0_0_10px_rgba(255,190,60,0.6)]"><Seth2Symbol :type="8" /></span>
          <span class="mt-1 px-2 text-sm font-bold text-amber-200">荷魯斯覺醒 · 神眼之力</span>
          <span class="mt-0.5 text-[10px] text-white/50">選台 · 覺醒倍數 · 三檔購買</span>
        </button>
      </div>

      <!-- 捕魚 -->
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <button
          class="group relative col-span-2 flex aspect-[2/1] flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#0a4a6e] via-[#06304a] to-[#031a2c] text-center ring-1 ring-cyan-300/50 transition hover:ring-cyan-200 hover:shadow-[0_0_24px_rgba(60,200,255,0.3)] sm:col-span-1 sm:aspect-[4/3]"
          @click="openGame = 'fish'"
        >
          <span class="absolute right-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">NEW</span>
          <canvas :ref="(el) => { fishCardCanvas = el as HTMLCanvasElement | null; drawFishCard() }" class="h-16 w-full" />
          <span class="mt-1 px-2 text-sm font-bold text-cyan-100">深海獵金</span>
          <span class="mt-0.5 text-[10px] text-white/50">三大漁場 · 鎖定/自動 · BOSS 龍王</span>
        </button>
      </div>

      <p class="mt-8 text-center text-2xs text-ink-300">本娛樂城為進修練習用途，使用虛擬遊戲幣，不涉及任何真實金錢交易。</p>
    </template>
  </div>
</template>
