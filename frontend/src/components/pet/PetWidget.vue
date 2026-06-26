<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Heart, Moon, Settings2, X } from 'lucide-vue-next'
import WalkingCreature, { type PetBehavior } from '@/components/pet/WalkingCreature.vue'
import { usePet } from '@/composables/usePet'

const pet = usePet()

// ---- Behaviour state machine + bottom-strip roaming (mode A) ----
const x = ref(280)
const facing = ref<1 | -1>(1)
const behavior = ref<PetBehavior>('walk')
const popoverOpen = ref(false)
const hearts = ref<number[]>([])

const PET_W = 80 // side-view creature is landscape
const SPEED = 0.5 // px per frame (~33fps)

const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 640)

let timer: ReturnType<typeof setInterval> | undefined
let phaseTimer: ReturnType<typeof setTimeout> | undefined
let happyTimer: ReturnType<typeof setTimeout> | undefined

function bounds() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200
  // On desktop the 264px sidebar is fixed on the left — start past it so the pet
  // is never hidden behind it. On mobile/tablet the sidebar is an off-canvas drawer.
  const leftInset = w >= 1024 ? 280 : 16
  // Keep clear of the chat bubble in the bottom-right corner.
  return { min: leftInset, max: Math.max(leftInset, w - PET_W - 88) }
}

// Pick a stationary "thing to do" with weights — common pottering, rarer naps.
function pickIdleBehavior(): PetBehavior {
  const r = Math.random()
  if (r < 0.42) return 'idle'   // look around / breathe
  if (r < 0.68) return 'sniff'  // sniff the ground
  if (r < 0.86) return 'sit'    // sit a while
  return 'sleep'                // nap
}

// How long to linger in each behaviour before walking again.
function behaviorDuration(b: PetBehavior): number {
  if (b === 'walk') return 3500 + Math.random() * 5000
  if (b === 'sleep') return 5000 + Math.random() * 5000
  if (b === 'sit') return 3000 + Math.random() * 3500
  return 1800 + Math.random() * 2600 // idle / sniff
}

function scheduleNextPhase() {
  clearTimeout(phaseTimer)
  const next = () => {
    if (behavior.value === 'walk') {
      behavior.value = pickIdleBehavior()
    } else {
      behavior.value = 'walk'
      if (Math.random() < 0.5) facing.value = facing.value === 1 ? -1 : 1
    }
    scheduleNextPhase()
  }
  phaseTimer = setTimeout(next, behaviorDuration(behavior.value))
}

function step() {
  if (behavior.value !== 'walk') return
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
  x.value = bounds().min
  if (!reduceMotion && !isMobile.value) {
    if (!timer) timer = setInterval(step, 33)
    behavior.value = 'walk'
    scheduleNextPhase()
  } else {
    behavior.value = 'idle'
  }
}
function stopRoaming() {
  clearInterval(timer)
  clearTimeout(phaseTimer)
  clearTimeout(happyTimer)
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
    // React: a happy little hop, then resume the normal routine.
    if (!reduceMotion) {
      behavior.value = 'happy'
      clearTimeout(phaseTimer)
      clearTimeout(happyTimer)
      happyTimer = setTimeout(() => { behavior.value = 'walk'; scheduleNextPhase() }, 1500)
    }
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
          class="glass absolute bottom-[92px] left-1/2 w-56 -translate-x-1/2 rounded-2xl p-3.5"
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

      <!-- The creature (faces its walking direction via scaleX) -->
      <button
        class="block h-16 w-20 transition-transform active:scale-95"
        :style="{ transform: `scaleX(${facing})` }"
        :aria-label="`${pet.data.value.name}（${moodLabel}）`"
        @click="onPetClick"
      >
        <WalkingCreature :animal="pet.data.value.animal" :behavior="behavior" />
      </button>
      <!-- Sleep zzz -->
      <span v-if="behavior === 'sleep'" class="pet-zzz pointer-events-none absolute right-1 top-2 text-xs font-bold text-ink-400">z</span>
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
