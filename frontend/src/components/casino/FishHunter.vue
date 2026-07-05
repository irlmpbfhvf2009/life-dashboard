<script setup lang="ts">
// 深海獵金 — fish hunter arcade. Canvas engine draws original procedural art;
// every kill is resolved server-side via batched volleys (see FishHunterService).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, Crosshair, Minus, Music, Plus, Bot, Volume2, VolumeX } from 'lucide-vue-next'
import { gameApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useWallet } from '@/composables/useWallet'
import { FishEngine, ROOMS, type RoomCfg } from '@/components/casino/fish/engine'
import { SPECIES } from '@/components/casino/fish/art'
import { useFishSound } from '@/components/casino/fish/sound'

defineEmits<{ back: [] }>()

const auth = useAuthStore()
const { coins, setBalance, refresh } = useWallet()
const sound = useFishSound()

// ---- phases: loading splash → room lobby → game ----
const phase = ref<'load' | 'lobby' | 'game'>('load')
const loadPct = ref(0)
const room = ref<RoomCfg>(ROOMS[0])

onMounted(() => {
  refresh()
  const t0 = performance.now()
  const dur = 1500
  const tick = (now: number) => {
    if (phase.value !== 'load') return
    const p = Math.min(1, (now - t0) / dur)
    loadPct.value = Math.round(100 * (1 - Math.pow(1 - p, 2.2)))
    if (p < 1) requestAnimationFrame(tick)
    else setTimeout(() => { if (phase.value === 'load') phase.value = 'lobby' }, 200)
  }
  requestAnimationFrame(tick)
  setTimeout(() => { if (phase.value === 'load') { loadPct.value = 100; phase.value = 'lobby' } }, 2400)
})

// lobby cards: animated fish preview canvases
const previewCanvases = ref<(HTMLCanvasElement | null)[]>([null, null, null])
const PREVIEW_FISH = [3, 7, 13] // puffer / turtle / golden shark
let previewRaf = 0
function runPreviews() {
  const step = (now: number) => {
    if (phase.value !== 'lobby') { previewRaf = 0; return }
    previewCanvases.value.forEach((c, i) => {
      if (!c) return
      const g = c.getContext('2d')!
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (c.width !== c.clientWidth * dpr) { c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, c.clientWidth, c.clientHeight)
      g.save()
      g.translate(c.clientWidth / 2, c.clientHeight / 2 + Math.sin(now / 700 + i * 2) * 5)
      const spec = SPECIES[PREVIEW_FISH[i]]
      const s = Math.min(c.clientWidth * 0.72, 130)
      spec.draw(g, s, now / 1000 + i * 3)
      g.restore()
    })
    previewRaf = requestAnimationFrame(step)
  }
  if (!previewRaf) previewRaf = requestAnimationFrame(step)
}

// ---- game state ----
const canvasEl = ref<HTMLCanvasElement | null>(null)
let engine: FishEngine | null = null

const bet = ref(1)
const autoOn = ref(false)
const lockOn = ref(false)
const bossBanner = ref('')
const bigWin = ref(0)
const toast = ref('')
const sessionWin = ref(0)

// local display balance: decremented per shot, overwritten by server on flush
const displayCoins = ref(0)

// volley batching
let pendingShots = 0
let pendingHits: { hitId: number; speciesId: number }[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let flushing = false

const betIdx = computed(() => room.value.bets.indexOf(bet.value))

function enterRoom(r: RoomCfg) {
  room.value = r
  bet.value = r.bets[0]
  phase.value = 'game'
  displayCoins.value = coins.value
  sound.startMusic()
  requestAnimationFrame(() => {
    if (!canvasEl.value) return
    engine = new FishEngine(canvasEl.value, r, {
      onShot: () => {
        if (!auth.isAuthenticated || displayCoins.value < bet.value) {
          if (autoOn.value) setAuto(false)
          showToast('金幣不足')
          return false
        }
        displayCoins.value -= bet.value
        pendingShots++
        return true
      },
      onHit: (hitId, speciesId) => { pendingHits.push({ hitId, speciesId }) },
      onBossWarn: (name) => {
        bossBanner.value = `${name} 現身！`
        sound.boss()
        setTimeout(() => { bossBanner.value = '' }, 3200)
      },
      sound,
    })
    window.addEventListener('resize', onResize)
  })
  flushTimer = setInterval(flush, 600)
}

function leaveRoom() {
  void flush()
  cleanupGame()
  phase.value = 'lobby'
}

function cleanupGame() {
  engine?.destroy()
  engine = null
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
  window.removeEventListener('resize', onResize)
  autoOn.value = false
  lockOn.value = false
}

onBeforeUnmount(() => {
  void flush()
  cleanupGame()
  sound.stopMusic()
  if (previewRaf) cancelAnimationFrame(previewRaf)
})

const onResize = () => engine?.resize()

async function flush() {
  if (flushing || (pendingShots === 0 && pendingHits.length === 0)) return
  flushing = true
  const shots = pendingShots
  const hits = pendingHits
  pendingShots = 0
  pendingHits = []
  try {
    const res = await gameApi.fishVolley(bet.value, shots, hits.map((h) => h.speciesId))
    setBalance(res.balance)
    displayCoins.value = res.balance
    if (res.totalWin > 0) sessionWin.value += res.totalWin
    res.wins.forEach((win, i) => {
      engine?.resolveHit(hits[i].hitId, win)
      if (win >= bet.value * 60) {
        bigWin.value = win
        sound.bigWin()
        setTimeout(() => { bigWin.value = 0 }, 2600)
      }
    })
  } catch {
    // insufficient coins or network hiccup — resync with the server
    if (autoOn.value) setAuto(false)
    await refresh()
    displayCoins.value = coins.value
    showToast('結算失敗，已重新同步餘額')
  } finally {
    flushing = false
  }
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => { if (toast.value === msg) toast.value = '' }, 2000)
}

// ---- controls ----
function stepBet(dir: 1 | -1) {
  const bets = room.value.bets
  const i = Math.min(Math.max(betIdx.value + dir, 0), bets.length - 1)
  bet.value = bets[i]
}
function setAuto(v: boolean) {
  autoOn.value = v
  if (engine) engine.auto = v
}
function setLock(v: boolean) {
  lockOn.value = v
  if (engine) engine.lock = v
}

// pointer → aim/fire
function evPos(e: PointerEvent) {
  const rect = canvasEl.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}
function onPointerDown(e: PointerEvent) {
  if (!engine) return
  canvasEl.value?.setPointerCapture(e.pointerId)
  const p = evPos(e)
  engine.aimAt(p.x, p.y)
  engine.setFiring(true)
}
function onPointerMove(e: PointerEvent) {
  if (!engine) return
  const p = evPos(e)
  engine.aimAt(p.x, p.y)
}
function onPointerUp() { engine?.setFiring(false) }

const displayName = computed(() => auth.profile?.displayName || auth.profile?.email?.split('@')[0] || '玩家')
</script>

<template>
  <div class="select-none">
    <!-- ======== loading splash ======== -->
    <div v-if="phase === 'load'" class="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#06344e] via-[#052840] to-[#031828] p-10 ring-1 ring-cyan-400/25">
      <div class="mx-auto max-w-sm text-center">
        <p class="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 drop-shadow">深海獵金</p>
        <p class="mt-1 text-xs text-cyan-200/60">DEEP SEA GOLD HUNTER</p>
        <div class="mt-8 h-3 overflow-hidden rounded-full bg-black/40 ring-1 ring-cyan-300/20">
          <div class="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 transition-[width]" :style="{ width: loadPct + '%' }" />
        </div>
        <p class="mt-2 text-xs text-cyan-100/50">正在裝填魚雷… {{ loadPct }}%</p>
      </div>
      <div class="pointer-events-none absolute inset-0 opacity-30">
        <div v-for="n in 14" :key="n" class="fh-bubble" :style="{ left: (n * 7.1) % 100 + '%', animationDelay: (n * 0.37) % 2 + 's', width: 4 + (n % 4) * 3 + 'px', height: 4 + (n % 4) * 3 + 'px' }" />
      </div>
    </div>

    <!-- ======== room lobby ======== -->
    <div v-else-if="phase === 'lobby'" class="rounded-2xl bg-gradient-to-b from-[#07405c] via-[#053652] to-[#032538] p-4 ring-1 ring-cyan-400/25 sm:p-6">
      <div class="mb-4 flex items-center justify-between">
        <button class="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/20" @click="$emit('back')">
          <ArrowLeft class="h-3.5 w-3.5" /> 返回
        </button>
        <p class="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500">深海獵金 · 選擇漁場</p>
        <span class="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-[#1c0f06]">💰 {{ coins.toLocaleString() }}</span>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <button
          v-for="(r, i) in ROOMS" :key="r.key"
          class="group relative overflow-hidden rounded-2xl p-4 pb-5 text-center ring-1 ring-amber-300/30 transition hover:ring-amber-300/80 hover:shadow-[0_0_28px_rgba(80,220,255,0.25)]"
          :style="{ background: `linear-gradient(165deg, ${r.palette.top}, ${r.palette.bottom})` }"
          @click="enterRoom(r)"
        >
          <div class="mx-auto grid h-36 w-36 place-items-center rounded-full bg-black/25 ring-2 ring-amber-300/50 transition group-hover:scale-105">
            <canvas :ref="(el) => { previewCanvases[i] = el as HTMLCanvasElement | null; runPreviews() }" class="h-32 w-32" />
          </div>
          <p class="mt-3 rounded-full bg-black/30 px-3 py-0.5 text-xs font-bold text-cyan-100/90 ring-1 ring-cyan-200/30 inline-block">{{ r.sub }}</p>
          <p class="mt-2 text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-400 drop-shadow">{{ r.name }}</p>
        </button>
      </div>
      <p class="mt-4 text-center text-2xs text-cyan-100/40">虛擬遊戲幣 · 每發子彈按底注扣款 · 命中由伺服器判定（RTP 94%）</p>
    </div>

    <!-- ======== game ======== -->
    <div v-else class="relative overflow-hidden rounded-2xl ring-1 ring-cyan-400/30">
      <canvas
        ref="canvasEl"
        class="block h-[62vh] min-h-[380px] w-full touch-none cursor-crosshair"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />

      <!-- HUD: player chip (top-left) -->
      <div class="pointer-events-none absolute left-2 top-2 flex items-center gap-2 rounded-xl bg-black/45 px-2.5 py-1.5 ring-1 ring-amber-300/40 backdrop-blur-sm">
        <img v-if="auth.profile?.photoUrl" :src="auth.profile.photoUrl" class="h-8 w-8 rounded-lg object-cover ring-1 ring-amber-300/60" alt="">
        <div v-else class="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 text-sm font-black text-white">{{ displayName[0] }}</div>
        <div class="leading-tight">
          <p class="max-w-[110px] truncate text-[11px] font-bold text-white/90">{{ displayName }}</p>
          <p class="text-[12px] font-black text-amber-300">💰 {{ displayCoins.toLocaleString() }}</p>
        </div>
      </div>

      <!-- HUD: top-right controls -->
      <div class="absolute right-2 top-2 flex items-center gap-1.5">
        <span v-if="sessionWin > 0" class="rounded-lg bg-black/45 px-2 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-300/30 backdrop-blur-sm">本場 +{{ sessionWin.toLocaleString() }}</span>
        <button class="fh-iconbtn" :title="sound.muted.value ? '開啟音效' : '靜音'" @click="sound.toggleMute()">
          <VolumeX v-if="sound.muted.value" class="h-4 w-4" /><Volume2 v-else class="h-4 w-4" />
        </button>
        <button class="fh-iconbtn" :class="sound.musicOn.value ? 'text-amber-300' : ''" title="音樂" @click="sound.toggleMusic()">
          <Music class="h-4 w-4" />
        </button>
        <button class="fh-iconbtn" title="離開漁場" @click="leaveRoom">
          <ArrowLeft class="h-4 w-4" />
        </button>
      </div>

      <!-- decorative co-op seats -->
      <p class="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[11px] font-bold tracking-widest text-emerald-300/40">{{ room.name }}</p>

      <!-- boss banner -->
      <Transition name="fh-pop">
        <div v-if="bossBanner" class="pointer-events-none absolute inset-x-0 top-[30%] text-center">
          <p class="inline-block rounded-2xl bg-black/55 px-6 py-2 text-2xl font-black tracking-widest text-red-400 ring-2 ring-red-400/60 drop-shadow-[0_0_18px_rgba(255,60,60,0.6)]">⚠ {{ bossBanner }}</p>
        </div>
      </Transition>

      <!-- big win -->
      <Transition name="fh-pop">
        <div v-if="bigWin > 0" class="pointer-events-none absolute inset-0 grid place-items-center bg-black/35">
          <div class="text-center">
            <p class="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 drop-shadow-[0_0_24px_rgba(255,200,60,0.8)] sm:text-5xl">巨額捕獲</p>
            <p class="mt-2 text-2xl font-black text-amber-300 sm:text-4xl">+{{ bigWin.toLocaleString() }}</p>
          </div>
        </div>
      </Transition>

      <!-- toast -->
      <Transition name="fh-pop">
        <p v-if="toast" class="pointer-events-none absolute inset-x-0 bottom-24 text-center">
          <span class="rounded-full bg-black/70 px-4 py-1.5 text-xs font-bold text-white/90">{{ toast }}</span>
        </p>
      </Transition>

      <!-- bottom control bar -->
      <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
        <!-- bet stepper -->
        <div class="flex items-center gap-1.5 rounded-xl bg-black/50 p-1 ring-1 ring-amber-300/40 backdrop-blur-sm">
          <button class="fh-betbtn" :disabled="betIdx <= 0" @click="stepBet(-1)"><Minus class="h-4 w-4" /></button>
          <span class="min-w-[64px] text-center font-mono text-lg font-black text-amber-300">{{ bet.toLocaleString() }}</span>
          <button class="fh-betbtn" :disabled="betIdx >= room.bets.length - 1" @click="stepBet(1)"><Plus class="h-4 w-4" /></button>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="fh-ctrlbtn" :class="autoOn ? 'ring-fuchsia-300 text-fuchsia-200 shadow-[0_0_14px_rgba(240,100,255,0.5)]' : ''"
            @click="setAuto(!autoOn)"
          >
            <Bot class="h-5 w-5" /><span>自動</span>
          </button>
          <button
            class="fh-ctrlbtn" :class="lockOn ? 'ring-red-300 text-red-200 shadow-[0_0_14px_rgba(255,80,80,0.5)]' : ''"
            @click="setLock(!lockOn)"
          >
            <Crosshair class="h-5 w-5" /><span>鎖定</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fh-iconbtn {
  @apply grid h-8 w-8 place-items-center rounded-lg bg-black/45 text-white/80 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/65 hover:text-white;
}
.fh-betbtn {
  @apply grid h-8 w-8 place-items-center rounded-lg bg-amber-400/90 text-[#241203] transition hover:bg-amber-300 disabled:opacity-30;
}
.fh-ctrlbtn {
  @apply flex flex-col items-center gap-0.5 rounded-xl bg-black/50 px-3.5 py-1.5 text-[10px] font-bold text-cyan-100/90 ring-1 ring-cyan-300/40 backdrop-blur-sm transition hover:bg-black/70;
}
.fh-bubble {
  position: absolute;
  bottom: -12px;
  border-radius: 9999px;
  border: 1px solid rgba(190, 235, 255, 0.6);
  animation: fh-rise 2.6s linear infinite;
}
@keyframes fh-rise {
  to { transform: translateY(-46vh); opacity: 0; }
}
.fh-pop-enter-active, .fh-pop-leave-active { transition: all 0.25s ease; }
.fh-pop-enter-from, .fh-pop-leave-to { opacity: 0; transform: scale(0.9); }
</style>
