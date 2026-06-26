<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Heart, Moon, Settings2, X } from 'lucide-vue-next'
import Creature from '@/components/health/Creature.vue'
import { usePet } from '@/composables/usePet'

const pet = usePet()

// ---- Walk state (mode A: strolls along the bottom of the viewport) ----
const x = ref(24)
const facing = ref<1 | -1>(1)
const phase = ref<'walk' | 'idle' | 'sleep'>('walk')
const popoverOpen = ref(false)
const hearts = ref<number[]>([])

const PET_W = 64
const SPEED = 0.55 // px per frame (~33fps)

const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 640)

let timer: ReturnType<typeof setInterval> | undefined
let phaseTimer: ReturnType<typeof setTimeout> | undefined

function bounds() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200
  // Keep clear of the chat bubble in the bottom-right corner.
  return { min: 16, max: Math.max(16, w - PET_W - 88) }
}

function scheduleNextPhase() {
  clearTimeout(phaseTimer)
  // Mostly walking, with occasional pauses and a rare nap.
  const r = Math.random()
  if (phase.value === 'walk') {
    phaseTimer = setTimeout(() => {
      const n = Math.random()
      phase.value = n < 0.18 ? 'sleep' : 'idle'
      scheduleNextPhase()
    }, 6000 + r * 6000)
  } else {
    phaseTimer = setTimeout(() => {
      phase.value = 'walk'
      if (Math.random() < 0.5) facing.value = facing.value === 1 ? -1 : 1
      scheduleNextPhase()
    }, phase.value === 'sleep' ? 4000 + r * 3000 : 1500 + r * 2500)
  }
}

function step() {
  if (phase.value !== 'walk') return
  const { min, max } = bounds()
  x.value += SPEED * facing.value
  if (x.value <= min) { x.value = min; facing.value = 1 }
  else if (x.value >= max) { x.value = max; facing.value = -1 }
}

function onResize() {
  isMobile.value = window.innerWidth < 640
  const { min, max } = bounds()
  x.value = Math.min(max, Math.max(min, x.value))
}

function startRoaming() {
  if (isMobile.value) x.value = 16
  if (!reduceMotion && !isMobile.value) {
    if (!timer) timer = setInterval(step, 33)
    phase.value = 'walk'
    scheduleNextPhase()
  } else {
    phase.value = 'idle'
  }
}
function stopRoaming() {
  clearInterval(timer)
  clearTimeout(phaseTimer)
  timer = undefined
}

onMounted(() => {
  pet.checkInToday()
  if (pet.enabled.value) startRoaming()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  stopRoaming()
  window.removeEventListener('resize', onResize)
})

// Start/stop the walk loop only while the pet is enabled (no idle interval when off).
watch(pet.enabled, (on) => {
  if (on) { pet.checkInToday(); startRoaming() } else { stopRoaming(); popoverOpen.value = false }
})

function onPetClick() {
  popoverOpen.value = !popoverOpen.value
  if (pet.pet()) {
    const id = Date.now()
    hearts.value.push(id)
    setTimeout(() => { hearts.value = hearts.value.filter((h) => h !== id) }, 900)
  }
}

function rest() {
  pet.setEnabled(false)
  popoverOpen.value = false
}

const moodLabel = computed(() => ({ great: '心情很好', good: '還不錯', tired: '想你了' }[pet.mood.value]))
</script>

<template>
  <div
    v-if="pet.enabled.value"
    class="pointer-events-none fixed bottom-3 left-0 z-30 select-none"
    :style="{ transform: `translateX(${x}px)` }"
  >
    <div class="pointer-events-auto relative" :style="{ width: PET_W + 'px' }">
      <!-- Popover card -->
      <Transition name="pet-pop">
        <div
          v-if="popoverOpen"
          class="glass absolute bottom-[72px] left-1/2 w-56 -translate-x-1/2 rounded-2xl p-3.5"
        >
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-ink-800">{{ pet.data.value.name }}</p>
            <button class="text-ink-300 hover:text-ink-500" aria-label="關閉" @click="popoverOpen = false">
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
          <p class="mt-0.5 text-2xs text-ink-400">Lv.{{ pet.data.value.level }} · {{ moodLabel }}</p>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200/60">
            <div class="h-full rounded-full bg-gradient-to-r from-brand-400 to-cyan-400" :style="{ width: pet.xpPercent.value + '%' }" />
          </div>
          <p class="mt-1 text-right text-2xs text-ink-400">{{ pet.data.value.xp }}/{{ pet.data.value.xpToNext }} XP</p>
          <div class="mt-2.5 flex items-center gap-1.5">
            <RouterLink
              to="/pet"
              class="flex flex-1 items-center justify-center gap-1 rounded-lg border border-ink-200/60 px-2 py-1.5 text-2xs font-medium text-ink-600 hover:bg-ink-50/50"
              @click="popoverOpen = false"
            >
              <Settings2 class="h-3 w-3" /> 設定
            </RouterLink>
            <button
              class="flex flex-1 items-center justify-center gap-1 rounded-lg border border-ink-200/60 px-2 py-1.5 text-2xs font-medium text-ink-600 hover:bg-ink-50/50"
              @click="rest"
            >
              <Moon class="h-3 w-3" /> 讓牠休息
            </button>
          </div>
        </div>
      </Transition>

      <!-- Floating hearts on petting -->
      <span
        v-for="h in hearts" :key="h"
        class="pet-heart pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-rose-400"
      >
        <Heart class="h-4 w-4" fill="currentColor" :stroke-width="0" />
      </span>

      <!-- The creature -->
      <button
        class="block h-16 w-16 transition-transform active:scale-95"
        :style="{ transform: `scaleX(${facing})` }"
        :aria-label="`${pet.data.value.name}（${moodLabel}）`"
        @click="onPetClick"
      >
        <Creature
          :animal="pet.data.value.animal"
          :accessory="pet.data.value.accessory"
          :mood="phase === 'sleep' ? 'tired' : pet.mood.value"
          :bob="phase === 'walk'"
        />
      </button>
      <!-- Sleep zzz -->
      <span v-if="phase === 'sleep'" class="pet-zzz pointer-events-none absolute -right-1 top-0 text-xs font-bold text-ink-400">z</span>
    </div>
  </div>
</template>

<style scoped>
.pet-pop-enter-active, .pet-pop-leave-active { transition: opacity 0.15s ease; }
.pet-pop-enter-from, .pet-pop-leave-to { opacity: 0; }
.pet-heart { animation: pet-heart-rise 0.9s ease-out forwards; }
@keyframes pet-heart-rise {
  0% { opacity: 0; transform: translate(-50%, 0) scale(0.6); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -28px) scale(1); }
}
.pet-zzz { animation: pet-zzz 2s ease-in-out infinite; }
@keyframes pet-zzz {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-4px); }
}
</style>
