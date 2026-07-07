<script setup lang="ts">
// 遊戲娛樂城 — the arcade now lives inside the studio (娛樂 > 遊戲) instead of
// the old standalone /play portal. Two categories: 電子 (Horus tumble slot) and
// 捕魚 (深海獵金 fish hunter).
import { ref, onMounted, computed } from 'vue'
import { Coins, Lock } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useWallet } from '@/composables/useWallet'
import { userApi } from '@/api'
import Seth2Slot from '@/components/casino/Seth2Slot.vue'
import Seth2Symbol from '@/components/casino/Seth2Symbol.vue'
import FishHunter from '@/components/casino/FishHunter.vue'
import { SPECIES } from '@/components/casino/fish/art'

const auth = useAuthStore()
const { coins, refresh } = useWallet()

// 娛樂城（電子/捕魚）用伺服器錢包，需要 isPlayer 權限——只能由管理後台開通。
// 進頁時仍會嘗試自助開通，但那只對「無任何角色」的純遊戲帳號有效；studio 帳號
// 會 no-op（後端刻意保留 casino 為 opt-in）。故 studio 但未被勾玩家者這裡會是 false。
const canPlayCasino = computed(() => auth.isPlayer)

const CATEGORIES = [
  { key: 'electronic', label: '電子', emoji: '🎰' },
  { key: 'fishing', label: '捕魚', emoji: '🐟' },
  { key: 'coop', label: '合作', emoji: '🥬' },
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
    <!-- Header — 只保留遊戲幣餘額 -->
    <div class="mb-4 flex justify-end">
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
      <template v-if="activeCat === 'electronic'">
        <div v-if="!canPlayCasino" class="mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-300 ring-1 ring-amber-400/30">
          <Lock class="mt-0.5 h-4 w-4 shrink-0" />
          <span>此帳號尚未開通娛樂城遊戲權限。請洽管理員於<b>管理後台</b>勾選「玩家」身分後即可遊玩（合作類的菜菜勇者團不受限）。</span>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <button
            class="group relative col-span-2 flex aspect-[2/1] flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#5a1a10] via-[#3a1208] to-[#140602] text-center ring-1 ring-amber-400/50 transition hover:ring-amber-300 hover:shadow-[0_0_24px_rgba(255,190,60,0.25)] sm:col-span-1 sm:aspect-[4/3]"
            :class="!canPlayCasino && 'pointer-events-none opacity-40 grayscale'"
            :disabled="!canPlayCasino"
            @click="openGame = 'horus'"
          >
            <span v-if="!canPlayCasino" class="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px]">🔒</span>
            <span class="absolute right-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">HOT</span>
            <span class="block h-12 w-12 drop-shadow-[0_0_10px_rgba(255,190,60,0.6)]"><Seth2Symbol :type="8" /></span>
            <span class="mt-1 px-2 text-sm font-bold text-amber-200">荷魯斯覺醒 · 神眼之力</span>
            <span class="mt-0.5 text-[10px] text-white/50">選台 · 覺醒倍數 · 三檔購買</span>
          </button>
        </div>
      </template>

      <!-- 合作 -->
      <div v-if="activeCat === 'coop'" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <button
          class="group relative col-span-2 flex aspect-[2/1] flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#1e4a1a] via-[#123510] to-[#061a06] text-center ring-1 ring-lime-400/50 transition hover:ring-lime-300 hover:shadow-[0_0_24px_rgba(163,230,53,0.3)] sm:col-span-1 sm:aspect-[4/3]"
          @click="$router.push('/veggie')"
        >
          <span class="absolute right-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">NEW</span>
          <span class="text-4xl">🥬🥔🥕</span>
          <span class="mt-1 px-2 text-sm font-bold text-lime-200">菜菜勇者團：無盡農場</span>
          <span class="mt-0.5 text-[10px] text-white/50">1~4 人連線合作 · Roguelike 生存 · 無盡 Boss</span>
        </button>
      </div>

      <!-- 捕魚 -->
      <template v-if="activeCat === 'fishing'">
        <div v-if="!canPlayCasino" class="mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-300 ring-1 ring-amber-400/30">
          <Lock class="mt-0.5 h-4 w-4 shrink-0" />
          <span>此帳號尚未開通娛樂城遊戲權限。請洽管理員於<b>管理後台</b>勾選「玩家」身分後即可遊玩（合作類的菜菜勇者團不受限）。</span>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <button
            class="group relative col-span-2 flex aspect-[2/1] flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#0a4a6e] via-[#06304a] to-[#031a2c] text-center ring-1 ring-cyan-300/50 transition hover:ring-cyan-200 hover:shadow-[0_0_24px_rgba(60,200,255,0.3)] sm:col-span-1 sm:aspect-[4/3]"
            :class="!canPlayCasino && 'pointer-events-none opacity-40 grayscale'"
            :disabled="!canPlayCasino"
            @click="openGame = 'fish'"
          >
            <span v-if="!canPlayCasino" class="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px]">🔒</span>
            <span class="absolute right-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">NEW</span>
            <canvas :ref="(el) => { fishCardCanvas = el as HTMLCanvasElement | null; drawFishCard() }" class="h-16 w-full" />
            <span class="mt-1 px-2 text-sm font-bold text-cyan-100">深海獵金</span>
            <span class="mt-0.5 text-[10px] text-white/50">三大漁場 · 鎖定/自動 · BOSS 龍王</span>
          </button>
        </div>
      </template>

    </template>
  </div>
</template>
