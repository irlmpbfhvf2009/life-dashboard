<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { ArrowLeft, Volume2, VolumeX, Music } from 'lucide-vue-next'
import { gameApi, type SethCell, type SethRound } from '@/api'
import { useWallet } from '@/composables/useWallet'
import { useAuthStore } from '@/stores/auth'
import { useSound } from '@/composables/useSound'
import SethSymbol from '@/components/casino/SethSymbol.vue'

defineEmits<{ back: [] }>()

const sound = useSound()
onUnmounted(() => sound.stopMusic())

// Pay symbols 0–7 (low→high), 8 = scatter, 9 = multiplier orb.
const SYMBOL_NAMES = ['藍寶石', '綠寶石', '紫寶石', '黃寶石', '紅寶石', '聖杯', '戒指', '安卡']
const TOP_PAY = [2, 4, 5, 8, 10, 12, 25, 50] // 12+ of a kind, × total bet
const SCATTER = 8
const ORB = 9
const BETS = [20, 100, 200, 1000]

const auth = useAuthStore()
const { coins, setBalance } = useWallet()

const BONUS_BUY_MULT = 100 // bonus buy costs bet × this
const ANTE_MULT = 1.25     // ante stake = bet × this

const bet = ref(20)
const ante = ref(false)
const pendingBuy = ref(false) // bonus-buy confirm step
const spinning = ref(false)
const grid = ref<SethCell[]>(Array.from({ length: 30 }, () => ({ type: 0, value: 0 })))
const frameKey = ref(0)
const highlight = ref<Set<number>>(new Set())
const orbFlash = ref(false)
const multiplierFlash = ref(0)
const winFlash = ref(0)

// Free-spin session state shown in the UI.
const freeMode = ref(false)
const freeIndex = ref(0)
const freeTotal = ref(0)
const freeSessionWin = ref(0)

const message = ref('歡迎來到法老寶藏 · 任意位置 8 個同符號即中獎')
const lastWin = ref(0)
const lastWinIsBig = ref(false)

const spinCost = computed(() => (ante.value ? Math.round(bet.value * ANTE_MULT) : bet.value))
const buyCost = computed(() => bet.value * BONUS_BUY_MULT)
const canSpin = computed(() => auth.isAuthenticated && coins.value >= spinCost.value && !spinning.value)
const canBuy = computed(() => auth.isAuthenticated && coins.value >= buyCost.value && !spinning.value)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function play(buyBonus = false) {
  pendingBuy.value = false
  if (spinning.value || !auth.isAuthenticated) return
  if (buyBonus ? !canBuy.value : !canSpin.value) return
  spinning.value = true
  message.value = ''
  lastWin.value = 0
  freeSessionWin.value = 0
  winFlash.value = 0
  multiplierFlash.value = 0
  sound.startMusic() // first spin is the user gesture that unlocks audio
  sound.spin()

  let res
  try {
    res = await gameApi.sethSpin(bet.value, { ante: ante.value && !buyBonus, buyBonus })
  } catch {
    message.value = '餘額不足或尚未開通遊戲權限'
    spinning.value = false
    return
  }

  for (const round of res.rounds) {
    if (round.type === 'FREE') {
      if (!freeMode.value) {
        freeMode.value = true
        sound.freeSpins()
        message.value = `🐊 觸發 ${res.freeSpins} 次免費旋轉！`
        await sleep(1100)
      }
      freeIndex.value = round.spinIndex
      freeTotal.value = round.spinTotal
    }
    await playRound(round)
    if (round.type === 'FREE') {
      freeSessionWin.value += round.pay
      message.value = `免費旋轉 ${round.spinIndex}/${round.spinTotal} · 累積贏 ${freeSessionWin.value.toLocaleString()}`
    }
  }

  setBalance(res.balance)
  freeMode.value = false
  const net = res.totalPayout - res.cost
  lastWin.value = res.totalPayout
  lastWinIsBig.value = res.totalPayout >= res.cost * 20
  message.value = res.totalPayout > 0
    ? `🎉 本局贏得 ${res.totalPayout.toLocaleString()}（淨 ${net >= 0 ? '+' : ''}${net.toLocaleString()}）`
    : '差一點，再接再厲'
  if (res.totalPayout > 0) sound.coins(lastWinIsBig.value ? 16 : 8)
  spinning.value = false
}

async function playRound(round: SethRound) {
  for (let i = 0; i < round.tumbles.length; i++) {
    const t = round.tumbles[i]
    grid.value = t.grid
    frameKey.value++
    sound.tumble(i)
    await sleep(i === 0 ? 480 : 420) // settle / drop
    if (t.winPositions.length) {
      highlight.value = new Set(t.winPositions)
      winFlash.value = t.pay
      sound.win(t.pay >= bet.value * 5)
      await sleep(620)
      highlight.value = new Set()
      winFlash.value = 0
      await sleep(120)
    }
  }
  // Orb multiplier flourish at the end of a winning sequence.
  if (round.pay > 0 && round.multiplier > 1) {
    orbFlash.value = true
    multiplierFlash.value = round.multiplier
    sound.orb(round.multiplier)
    await sleep(950)
    orbFlash.value = false
    multiplierFlash.value = 0
  }
}
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-b from-[#1a1140] via-[#241555] to-[#0c0822] p-4 ring-1 ring-amber-400/30 sm:p-6">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <button class="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white" @click="$emit('back')">
        <ArrowLeft class="h-4 w-4" /> 大廳
      </button>
      <h3 class="text-center text-lg font-black tracking-wide">
        <span class="bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent">⚱️ 法老寶藏</span>
      </h3>
      <div class="flex items-center gap-1.5">
        <span
          v-if="freeMode"
          class="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-[#1a1140]"
        >免費 {{ freeIndex }}/{{ freeTotal }}</span>
        <button
          class="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          :class="{ 'text-amber-300': sound.musicOn.value && !sound.muted.value }"
          :title="sound.musicOn.value ? '背景音樂：開' : '背景音樂：關'"
          @click="sound.toggleMusic()"
        ><Music class="h-4 w-4" /></button>
        <button
          class="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          :title="sound.muted.value ? '靜音中' : '音效：開'"
          @click="sound.toggleMute()"
        >
          <VolumeX v-if="sound.muted.value" class="h-4 w-4" />
          <Volume2 v-else class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Board -->
    <div class="relative mx-auto max-w-md rounded-xl bg-black/30 p-2 ring-1 ring-amber-400/20">
      <div class="grid grid-cols-6 gap-1.5">
        <div
          v-for="(c, i) in grid" :key="i"
          class="relative flex aspect-square items-center justify-center rounded-lg shadow-inner transition-all duration-200"
          :class="[
            highlight.has(i) ? 'scale-110 bg-amber-400/30 ring-2 ring-amber-300 animate-pulse' : 'bg-white/5 ring-1 ring-white/10',
            c.type === ORB ? 'bg-fuchsia-500/20 ring-fuchsia-400/60' : '',
            c.type === SCATTER ? 'ring-amber-400/70' : '',
            orbFlash && c.type === ORB ? 'scale-110 animate-bounce' : '',
          ]"
        >
          <span :key="frameKey" class="seth-drop block h-[82%] w-[82%]">
            <SethSymbol :type="c.type" :value="c.value" />
          </span>
          <span
            v-if="c.type === ORB"
            class="absolute bottom-0 right-0.5 text-[10px] font-black text-fuchsia-100 drop-shadow sm:text-xs"
          >×{{ c.value }}</span>
        </div>
      </div>

      <!-- Win / multiplier overlays -->
      <div
        v-if="winFlash > 0"
        class="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-[#1a1140] shadow-lg"
      >+{{ winFlash.toLocaleString() }}</div>
      <div
        v-if="multiplierFlash > 0"
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span class="rounded-2xl bg-fuchsia-600/90 px-6 py-3 text-4xl font-black text-white shadow-2xl ring-4 ring-fuchsia-300/50 animate-pulse">
          ×{{ multiplierFlash }}
        </span>
      </div>
    </div>

    <!-- Message -->
    <p
      class="mt-3 min-h-[2.5rem] text-center text-sm font-bold"
      :class="lastWin > 0 ? 'text-amber-300' : 'text-white/70'"
    >{{ message }}</p>

    <!-- Bet -->
    <div class="mt-2 flex flex-wrap items-center justify-center gap-2">
      <span class="text-sm text-white/60">下注</span>
      <button
        v-for="b in BETS" :key="b"
        class="rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
        :class="bet === b ? 'bg-amber-400 text-[#1a1140]' : 'bg-white/10 text-white/70 hover:bg-white/20'"
        :disabled="spinning" @click="bet = b"
      >{{ b }}</button>
    </div>

    <!-- Ante toggle -->
    <div class="mt-2 flex items-center justify-center">
      <button
        class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold transition-colors"
        :class="ante ? 'bg-emerald-500/90 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'"
        :disabled="spinning" @click="ante = !ante"
      >
        <span class="grid h-3.5 w-3.5 place-items-center rounded-full" :class="ante ? 'bg-white' : 'bg-white/30'">
          <span v-if="ante" class="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
        </span>
        加注 +25%（提高免費旋轉觸發機率）
      </button>
    </div>

    <button
      class="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 py-3.5 text-base font-extrabold text-[#1a1140] shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!canSpin"
      @click="play(false)"
    >
      {{ !auth.isAuthenticated ? '請先登入' : spinning ? '連消中…' : coins < spinCost ? '遊戲幣不足' : `旋轉（-${spinCost.toLocaleString()}）` }}
    </button>

    <!-- Bonus buy (two-step confirm) -->
    <div class="mt-2">
      <button
        v-if="!pendingBuy"
        class="w-full rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/10 py-2 text-sm font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canBuy"
        @click="pendingBuy = true"
      >
        🐊 購買免費旋轉（-{{ buyCost.toLocaleString() }}）{{ coins < buyCost ? ' · 餘額不足' : '' }}
      </button>
      <div v-else class="flex gap-2">
        <button
          class="flex-1 rounded-xl bg-fuchsia-600 py-2 text-sm font-extrabold text-white shadow-lg transition hover:bg-fuchsia-500"
          @click="play(true)"
        >確認購買（-{{ buyCost.toLocaleString() }}）</button>
        <button
          class="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/20"
          @click="pendingBuy = false"
        >取消</button>
      </div>
    </div>

    <!-- Paytable -->
    <div class="mt-4 grid grid-cols-4 gap-1.5 text-center sm:grid-cols-8">
      <div v-for="(name, i) in SYMBOL_NAMES" :key="i" class="flex flex-col items-center rounded-lg bg-white/5 py-1.5">
        <span class="block h-7 w-7"><SethSymbol :type="i" /></span>
        <span class="block text-[10px] text-amber-300/80">×{{ TOP_PAY[i] }}</span>
        <span class="block text-[9px] text-white/30">{{ name }}</span>
      </div>
    </div>
    <p class="mt-3 text-center text-2xs text-white/30">
      🐊 聖獸×4 觸發免費旋轉 · ⚡ 倍數球中獎時加總相乘 · 免費旋轉倍數持續累加 · 虛擬幣練習用途，無真實金錢
    </p>
  </div>
</template>

<style scoped>
.seth-drop {
  display: inline-block;
  animation: seth-drop 0.28s ease-out;
}
@keyframes seth-drop {
  0% { transform: translateY(-40%); opacity: 0.2; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
