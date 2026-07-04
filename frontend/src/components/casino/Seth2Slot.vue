<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { ArrowLeft, Volume2, VolumeX, Music, Zap, RotateCw, X } from 'lucide-vue-next'
import { gameApi, type Seth2Buy, type Seth2Round, type SethCell } from '@/api'
import { useWallet } from '@/composables/useWallet'
import { useAuthStore } from '@/stores/auth'
import { useSound } from '@/composables/useSound'
import Seth2Symbol from '@/components/casino/Seth2Symbol.vue'

defineEmits<{ back: [] }>()

const sound = useSound()
onUnmounted(() => { sound.stopMusic(); auto.value = false })

// Pay symbols 0–8 (low→high), 9 = scatter, 10 = multiplier orb.
const SYMBOL_NAMES = ['藍鑽', '綠鑽', '紫寶石', '琥珀', '紅寶石', '神弓', '彎刀', '眼鏡蛇', '荷魯斯之眼']
const TOP_PAY = [0.4, 0.6, 0.9, 1.4, 2.2, 3.5, 6, 10, 15] // 12+ of a kind, × total bet
const SCATTER = 9
const ORB = 10
const BETS = [10, 20, 50, 100, 200]

const BUY_TIERS: { key: Seth2Buy; name: string; mult: number; desc: string; accent: string }[] = [
  { key: 'FREE', name: '免費遊戲', mult: 200, desc: '10 次免費遊戲\n有機會獲得覺醒之力', accent: 'amber' },
  { key: 'AWAKEN', name: '覺醒之力', mult: 500, desc: '必定獲得\n覺醒之力遊戲', accent: 'fuchsia' },
  { key: 'IMMORTAL', name: '不朽覺醒', mult: 2000, desc: '必定掉落 ×500\n且聖甲蟲有機會分裂', accent: 'red' },
]

const auth = useAuthStore()
const { coins, setBalance } = useWallet()

// ---- lobby (機台選擇, cosmetic flavour like the arcade original) ----
const phase = ref<'lobby' | 'game'>('lobby')
const machine = ref(0)
const hotMachine = Math.floor(Math.random() * 25) + 1
function pickMachine(n: number) {
  machine.value = n
  phase.value = 'game'
}

// ---- game state ----
const bet = ref(10)
const buyOpen = ref(false)
const turbo = ref(false)
const auto = ref(false)
const spinning = ref(false)
const grid = ref<SethCell[]>(Array.from({ length: 30 }, (_, i) => ({ type: i % 9, value: 0 })))
const frameKey = ref(0)
const highlight = ref<Set<number>>(new Set())
const orbFlash = ref(false)
const multiplierFlash = ref(0)
const winFlash = ref(0)
const awakenedNow = ref(false)

const freeMode = ref(false)
const freeIndex = ref(0)
const freeTotal = ref(0)
const freeSessionWin = ref(0)

const message = ref('任意位置 8 個同符號即中獎 · 3 個金聖甲蟲觸發免費遊戲')
const lastWin = ref(0)

const spinCost = computed(() => bet.value)
const canSpin = computed(() => auth.isAuthenticated && coins.value >= spinCost.value && !spinning.value)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const d = (ms: number) => (turbo.value ? Math.round(ms * 0.45) : ms)

function buyCost(mult: number) {
  return bet.value * mult
}

async function play(buy: Seth2Buy = 'NONE') {
  buyOpen.value = false
  if (spinning.value || !auth.isAuthenticated) return
  const cost = buy === 'NONE' ? spinCost.value : buyCost(BUY_TIERS.find((t) => t.key === buy)!.mult)
  if (coins.value < cost) {
    message.value = '遊戲幣不足'
    auto.value = false
    return
  }
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
    res = await gameApi.seth2Spin(bet.value, buy)
  } catch {
    message.value = '餘額不足或尚未開通遊戲權限'
    spinning.value = false
    auto.value = false
    return
  }

  for (const round of res.rounds) {
    if (round.type === 'FREE') {
      if (!freeMode.value) {
        freeMode.value = true
        sound.freeSpins()
        message.value = `✨ 觸發 ${res.freeSpins} 次免費遊戲！`
        await sleep(d(1100))
      }
      if (round.awakened && !awakenedNow.value) {
        awakenedNow.value = true
        sound.orb(10)
        message.value = '⚡ 覺醒之力發動！聖甲蟲倍數大幅提升'
        await sleep(d(1000))
      }
      freeIndex.value = round.spinIndex
      freeTotal.value = round.spinTotal
    }
    await playRound(round)
    if (round.type === 'FREE') {
      freeSessionWin.value += round.pay
      message.value = `免費遊戲 ${round.spinIndex}/${round.spinTotal} · 累積贏 ${freeSessionWin.value.toLocaleString()}`
    }
  }

  setBalance(res.balance)
  freeMode.value = false
  awakenedNow.value = false
  const net = res.totalPayout - res.cost
  lastWin.value = res.totalPayout
  const big = res.totalPayout >= res.cost * 20
  message.value = res.totalPayout > 0
    ? `🎉 本局贏得 ${res.totalPayout.toLocaleString()}（淨 ${net >= 0 ? '+' : ''}${net.toLocaleString()}）`
    : '差一點，再接再厲'
  if (res.totalPayout > 0) sound.coins(big ? 16 : 8)
  spinning.value = false

  // Auto-spin: keep going while toggled on and affordable.
  if (auto.value && buy === 'NONE') {
    await sleep(d(700))
    if (auto.value && !spinning.value && coins.value >= spinCost.value) void play('NONE')
    else auto.value = false
  }
}

async function playRound(round: Seth2Round) {
  for (let i = 0; i < round.tumbles.length; i++) {
    const t = round.tumbles[i]
    grid.value = t.grid
    frameKey.value++
    sound.tumble(i)
    await sleep(d(i === 0 ? 480 : 420))
    if (t.winPositions.length) {
      highlight.value = new Set(t.winPositions)
      winFlash.value = t.pay
      sound.win(t.pay >= bet.value * 5)
      await sleep(d(620))
      highlight.value = new Set()
      winFlash.value = 0
      await sleep(d(120))
    }
  }
  if (round.pay > 0 && round.multiplier > 1) {
    orbFlash.value = true
    multiplierFlash.value = round.multiplier
    sound.orb(round.multiplier)
    await sleep(d(950))
    orbFlash.value = false
    multiplierFlash.value = 0
  }
}

function stepBet(dir: 1 | -1) {
  const i = BETS.indexOf(bet.value)
  const next = BETS[Math.min(BETS.length - 1, Math.max(0, i + dir))]
  bet.value = next
}

function toggleAuto() {
  auto.value = !auto.value
  if (auto.value && !spinning.value) void play('NONE')
}
</script>

<template>
  <!-- ===================== 機台選擇大廳 ===================== -->
  <div
    v-if="phase === 'lobby'"
    class="rounded-2xl bg-gradient-to-b from-[#2a1608] via-[#1c0f06] to-[#0d0602] p-4 ring-1 ring-amber-500/40 sm:p-6"
  >
    <div class="mb-4 flex items-center justify-between">
      <button class="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white" @click="$emit('back')">
        <ArrowLeft class="h-4 w-4" /> 大廳
      </button>
      <h3 class="text-center text-lg font-black tracking-wide">
        <span class="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">戰神賽特II</span>
        <span class="ml-1 text-xs font-bold text-amber-200/70">覺醒之力</span>
      </h3>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-2.5 py-1 text-xs font-bold text-[#1c0f06]">
        💰 {{ coins.toLocaleString() }}
      </span>
    </div>

    <p class="mb-3 text-center text-xs text-amber-200/60">選擇機台開始遊戲（純氛圍，不影響結果）</p>

    <div class="grid grid-cols-5 gap-2">
      <button
        v-for="n in 25" :key="n"
        class="group flex flex-col items-center rounded-xl bg-white/5 py-2.5 ring-1 transition hover:bg-amber-400/10"
        :class="n === hotMachine ? 'ring-amber-400/80' : 'ring-white/10 hover:ring-amber-400/40'"
        @click="pickMachine(n)"
      >
        <span class="grid h-10 w-10 place-items-center rounded-full ring-2" :class="n === hotMachine ? 'bg-amber-400/25 ring-amber-400' : 'bg-black/40 ring-amber-700/50'">
          <span class="block h-7 w-7"><Seth2Symbol :type="9" /></span>
        </span>
        <span class="mt-1 text-sm font-bold" :class="n === hotMachine ? 'text-amber-300' : 'text-amber-100/70'">{{ n }}</span>
        <span v-if="n === hotMachine" class="text-[9px] font-black text-amber-400">HOT</span>
      </button>
    </div>

    <div class="mt-4 flex items-stretch gap-2">
      <div class="flex-1 rounded-xl bg-black/40 p-3 text-xs ring-1 ring-amber-500/20">
        <div class="mb-1.5 flex items-center justify-between font-bold text-amber-200">
          <span>近30日</span><span>免費遊戲最高 <span class="text-amber-400">-</span> 倍</span>
        </div>
        <div class="grid grid-cols-3 gap-y-1 text-white/50">
          <span>日期</span><span class="text-center">總下注</span><span class="text-right">得分率</span>
          <span class="text-amber-300/80">今日</span><span class="text-center">-</span><span class="text-right">-</span>
          <span>昨日</span><span class="text-center">-</span><span class="text-right">-</span>
          <span>近30日</span><span class="text-center">-</span><span class="text-right">-</span>
        </div>
      </div>
      <button
        class="w-28 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-sm font-black text-[#1c0f06] shadow-lg transition active:scale-[0.98]"
        @click="pickMachine(Math.floor(Math.random() * 25) + 1)"
      >自動選台</button>
    </div>
  </div>

  <!-- ===================== 遊戲主畫面 ===================== -->
  <div
    v-else
    class="rounded-2xl p-4 ring-1 transition-colors duration-500 sm:p-6"
    :class="awakenedNow
      ? 'bg-gradient-to-b from-[#4a0d12] via-[#2a0a10] to-[#12040a] ring-red-500/50'
      : 'bg-gradient-to-b from-[#152a3a] via-[#0e1c2c] to-[#070d16] ring-amber-500/30'"
  >
    <!-- Header -->
    <div class="mb-3 flex items-center justify-between">
      <button class="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white" @click="phase = 'lobby'">
        <ArrowLeft class="h-4 w-4" /> 選台
      </button>
      <h3 class="text-center text-lg font-black tracking-wide">
        <span class="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">戰神賽特II</span>
        <span class="ml-1 text-xs font-bold" :class="awakenedNow ? 'text-red-300' : 'text-amber-200/70'">覺醒之力 · NO.{{ machine }}</span>
      </h3>
      <div class="flex items-center gap-1.5">
        <span v-if="freeMode" class="rounded-full px-2.5 py-1 text-xs font-bold" :class="awakenedNow ? 'bg-red-500 text-white' : 'bg-amber-400 text-[#1c0f06]'">
          免費 {{ freeIndex }}/{{ freeTotal }}
        </span>
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

    <!-- 購買免費遊戲 + banner -->
    <div class="mb-3 flex flex-col items-center gap-2">
      <button
        class="rounded-full border px-4 py-1.5 text-sm font-black shadow transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        :class="awakenedNow
          ? 'border-red-400/60 bg-red-500/15 text-red-200 hover:bg-red-500/25'
          : 'border-amber-400/60 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'"
        :disabled="spinning"
        @click="buyOpen = true"
      >購買免費遊戲</button>
      <div class="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-1 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/40">
        出現 <span class="inline-block h-4 w-4"><Seth2Symbol :type="10" /></span> 可乘上獎金
      </div>
    </div>

    <!-- Board -->
    <div
      class="relative mx-auto max-w-md rounded-xl bg-black/40 p-2 ring-2 transition-colors duration-500"
      :class="awakenedNow ? 'ring-red-500/60' : 'ring-amber-500/40'"
    >
      <div class="grid grid-cols-6 gap-1.5">
        <div
          v-for="(c, i) in grid" :key="i"
          class="relative flex aspect-square items-center justify-center rounded-lg shadow-inner transition-all duration-200"
          :class="[
            highlight.has(i) ? 'scale-110 bg-amber-400/30 ring-2 ring-amber-300 animate-pulse' : 'bg-white/5 ring-1 ring-white/10',
            c.type === ORB ? 'bg-emerald-500/20 ring-emerald-400/60' : '',
            c.type === SCATTER ? 'ring-amber-400/70' : '',
            orbFlash && c.type === ORB ? 'scale-110 animate-bounce' : '',
          ]"
        >
          <span :key="frameKey" class="seth2-drop block h-[84%] w-[84%]">
            <Seth2Symbol :type="c.type" :value="c.value" />
          </span>
          <span
            v-if="c.type === ORB"
            class="absolute bottom-0 right-0.5 text-[10px] font-black text-emerald-100 drop-shadow sm:text-xs"
          >×{{ c.value }}</span>
        </div>
      </div>

      <!-- Win / multiplier overlays -->
      <div
        v-if="winFlash > 0"
        class="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-[#1c0f06] shadow-lg"
      >+{{ winFlash.toLocaleString() }}</div>
      <div v-if="multiplierFlash > 0" class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span class="rounded-2xl bg-emerald-600/90 px-6 py-3 text-4xl font-black text-white shadow-2xl ring-4 ring-emerald-300/50 animate-pulse">
          ×{{ multiplierFlash }}
        </span>
      </div>
    </div>

    <!-- Message -->
    <p
      class="mt-3 min-h-[2.5rem] text-center text-sm font-bold"
      :class="lastWin > 0 ? 'text-amber-300' : 'text-white/70'"
    >{{ message }}</p>

    <!-- 下注 / 贏分 / 餘額 -->
    <div class="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-xl bg-black/40 px-3 py-2 ring-1 ring-white/10">
      <div class="flex items-center justify-center gap-2">
        <button class="grid h-7 w-7 place-items-center rounded-full bg-white/10 font-black text-amber-300 hover:bg-white/20 disabled:opacity-40" :disabled="spinning" @click="stepBet(-1)">−</button>
        <div class="text-center">
          <p class="text-[10px] text-white/50">下注</p>
          <p class="text-sm font-black text-yellow-300">{{ bet }}</p>
        </div>
        <button class="grid h-7 w-7 place-items-center rounded-full bg-white/10 font-black text-amber-300 hover:bg-white/20 disabled:opacity-40" :disabled="spinning" @click="stepBet(1)">＋</button>
      </div>
      <div class="text-center">
        <p class="text-[10px] text-white/50">贏分</p>
        <p class="text-sm font-black text-yellow-300">{{ lastWin.toLocaleString() }}</p>
      </div>
      <div class="text-center">
        <p class="text-[10px] text-white/50">餘額</p>
        <p class="text-sm font-black text-yellow-300">{{ coins.toLocaleString() }}</p>
      </div>
    </div>

    <!-- Controls: turbo / spin / auto -->
    <div class="mx-auto mt-3 flex max-w-md items-center justify-center gap-4">
      <button
        class="grid h-12 w-12 place-items-center rounded-full ring-2 transition"
        :class="turbo ? 'bg-amber-400 text-[#1c0f06] ring-amber-300' : 'bg-black/50 text-white/60 ring-white/15 hover:text-white'"
        title="快速模式"
        @click="turbo = !turbo"
      ><Zap class="h-5 w-5" /></button>

      <button
        class="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-fuchsia-500 to-purple-800 ring-4 ring-amber-400/80 shadow-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canSpin"
        @click="play('NONE')"
      >
        <RotateCw class="h-9 w-9 text-amber-300" :class="{ 'animate-spin': spinning }" />
      </button>

      <button
        class="grid h-12 w-12 place-items-center rounded-full ring-2 transition"
        :class="auto ? 'bg-emerald-500 text-white ring-emerald-300' : 'bg-black/50 text-white/60 ring-white/15 hover:text-white'"
        :title="auto ? '自動旋轉：開' : '自動旋轉'"
        @click="toggleAuto()"
      ><span class="text-[10px] font-black leading-none">AUTO</span></button>
    </div>
    <p class="mt-1.5 text-center text-2xs text-white/40">
      {{ !auth.isAuthenticated ? '請先登入' : coins < spinCost ? '遊戲幣不足' : spinning ? '連消中…' : `每轉 -${spinCost.toLocaleString()}` }}
    </p>

    <!-- Paytable -->
    <div class="mt-4 grid grid-cols-5 gap-1.5 text-center sm:grid-cols-9">
      <div v-for="(name, i) in SYMBOL_NAMES" :key="i" class="flex flex-col items-center rounded-lg bg-white/5 py-1.5">
        <span class="block h-7 w-7"><Seth2Symbol :type="i" /></span>
        <span class="block text-[10px] text-amber-300/80">×{{ TOP_PAY[i] }}</span>
        <span class="block text-[9px] text-white/30">{{ name }}</span>
      </div>
    </div>
    <p class="mt-3 text-center text-2xs text-white/30">
      金聖甲蟲×3 觸發免費遊戲（×4 直接覺醒）· 綠聖甲蟲倍數於免費遊戲中持續累加 · 覺醒之力大幅提升倍數 · 虛擬幣練習用途，無真實金錢
    </p>

    <!-- ===== 購買免費遊戲 modal ===== -->
    <Teleport to="body">
      <div v-if="buyOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="buyOpen = false">
        <div class="w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#3a0d12] via-[#240a10] to-[#12040a] p-4 ring-2 ring-amber-500/50">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="inline-flex items-center gap-1.5 text-base font-black text-amber-300">
              3× <span class="text-xs">SCATTER</span> ＋ <span class="inline-block h-5 w-5"><Seth2Symbol :type="9" /></span> 覺醒之力
            </h4>
            <button class="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20" @click="buyOpen = false">
              <X class="h-4 w-4" />
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="t in BUY_TIERS" :key="t.key"
              class="flex flex-col items-center rounded-xl border p-2.5 text-center"
              :class="{
                'border-amber-400/50 bg-amber-400/5': t.accent === 'amber',
                'border-fuchsia-400/50 bg-fuchsia-400/5': t.accent === 'fuchsia',
                'border-red-400/50 bg-red-400/5': t.accent === 'red',
              }"
            >
              <p class="text-sm font-black" :class="{ 'text-amber-300': t.accent === 'amber', 'text-fuchsia-300': t.accent === 'fuchsia', 'text-red-300': t.accent === 'red' }">{{ t.name }}</p>
              <span class="my-1.5 block h-10 w-10"><Seth2Symbol :type="t.key === 'FREE' ? 9 : 10" /></span>
              <p class="min-h-[2.2rem] whitespace-pre-line text-[10px] leading-tight text-white/60">{{ t.desc }}</p>
              <p class="mt-1 text-sm font-black text-yellow-300">{{ buyCost(t.mult).toLocaleString() }}</p>
              <button
                class="mt-1.5 w-full rounded-lg py-1 text-xs font-black text-white shadow transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                :class="{ 'bg-amber-500 hover:bg-amber-400': t.accent === 'amber', 'bg-fuchsia-600 hover:bg-fuchsia-500': t.accent === 'fuchsia', 'bg-red-600 hover:bg-red-500': t.accent === 'red' }"
                :disabled="coins < buyCost(t.mult) || spinning"
                @click="play(t.key)"
              >{{ coins < buyCost(t.mult) ? '餘額不足' : '購買' }}</button>
            </div>
          </div>
          <p class="mt-3 text-center text-2xs text-white/40">下注 {{ bet }} · 購買價格＝下注 ×200／×500／×2000</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.seth2-drop {
  display: inline-block;
  animation: seth2-drop 0.28s ease-out;
}
@keyframes seth2-drop {
  0% { transform: translateY(-40%); opacity: 0.2; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
