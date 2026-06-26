<script lang="ts">
export type PetBehavior = 'walk' | 'idle' | 'sit' | 'sleep' | 'sniff' | 'happy'
</script>

<script setup lang="ts">
// Side-view companion rigged for a behaviour state machine. Faces RIGHT by
// default; the parent flips it (scaleX) to face left. Each behaviour toggles a
// `b-*` class that drives the rig (legs / tail / ear / head / body) via CSS.
import { computed } from 'vue'
import { animalDef, type AnimalKey } from '@/data/animals'

const props = withDefaults(
  defineProps<{ animal: AnimalKey; behavior?: PetBehavior }>(),
  { behavior: 'idle' },
)
const d = computed(() => animalDef(props.animal))
</script>

<template>
  <svg
    viewBox="0 0 140 116"
    class="h-full w-full drop-shadow-sm"
    :class="`b-${behavior}`"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="animal"
  >
    <g class="wc-root">
      <!-- tail -->
      <g class="wc-tail">
        <path d="M24 74 Q4 70 10 50 Q16 64 30 70 Z" :fill="d.body" />
      </g>

      <!-- far legs (behind body, darker for depth) -->
      <g class="wc-leg wc-leg-bf">
        <rect x="42" y="84" width="11" height="24" rx="5.5" :fill="d.ear" />
        <ellipse cx="47" cy="110" rx="8" ry="4" :fill="d.ear" />
      </g>
      <g class="wc-leg wc-leg-ff">
        <rect x="80" y="84" width="11" height="24" rx="5.5" :fill="d.ear" />
        <ellipse cx="85" cy="110" rx="8" ry="4" :fill="d.ear" />
      </g>

      <!-- body -->
      <ellipse cx="58" cy="70" rx="42" ry="29" :fill="d.body" />
      <ellipse cx="60" cy="80" rx="30" ry="17" :fill="d.snout" />

      <!-- head -->
      <g class="wc-head">
        <!-- ear -->
        <g class="wc-ear">
          <path d="M92 34 Q88 14 102 16 Q104 28 102 38 Z" :fill="d.ear" />
          <path d="M95 33 Q93 22 100 22 Q101 29 100 36 Z" :fill="d.innerEar" />
        </g>
        <ellipse cx="106" cy="52" rx="24" ry="22" :fill="d.body" />
        <ellipse cx="120" cy="60" rx="13" ry="11" :fill="d.snout" />
        <!-- eye: open + closed (sleep) -->
        <circle class="wc-eye" cx="110" cy="48" r="3.4" fill="#2c1d12" />
        <circle class="wc-eye-hl" cx="111.2" cy="46.8" r="1.1" fill="#fff" />
        <path class="wc-eye-shut" d="M105 48 q5 4 10 0" fill="none" stroke="#2c1d12" stroke-width="2.4" stroke-linecap="round" />
        <!-- nose + mouth -->
        <ellipse cx="131" cy="58" rx="4.2" ry="3.2" :fill="d.nose" />
        <path d="M127 64 q4 4 8 1" fill="none" stroke="#5b3b22" stroke-width="2" stroke-linecap="round" />
        <!-- whiskers -->
        <g v-if="d.whiskers" stroke="#c8ad8e" stroke-width="1.4" stroke-linecap="round">
          <line x1="134" y1="56" x2="120" y2="54" />
          <line x1="134" y1="61" x2="120" y2="61" />
        </g>
      </g>

      <!-- near legs (in front of body) -->
      <g class="wc-leg wc-leg-bn">
        <rect x="48" y="86" width="12" height="26" rx="6" :fill="d.body" />
        <ellipse cx="54" cy="113" rx="8.5" ry="4.5" :fill="d.ear" />
      </g>
      <g class="wc-leg wc-leg-fn">
        <rect x="86" y="86" width="12" height="26" rx="6" :fill="d.body" />
        <ellipse cx="92" cy="113" rx="8.5" ry="4.5" :fill="d.ear" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.wc-leg { transform-box: view-box; }
.wc-leg-bf { transform-origin: 47px 86px; }
.wc-leg-ff { transform-origin: 85px 86px; }
.wc-leg-bn { transform-origin: 54px 88px; }
.wc-leg-fn { transform-origin: 92px 88px; }
.wc-tail { transform-box: view-box; transform-origin: 28px 72px; }
.wc-ear { transform-box: view-box; transform-origin: 100px 34px; }
.wc-head { transform-box: view-box; transform-origin: 92px 64px; }
.wc-root { transform-box: view-box; transform-origin: 60px 110px; }
.wc-eye-shut { opacity: 0; }

/* ---------- WALK ---------- */
.b-walk .wc-root { animation: wc-bob 0.44s ease-in-out infinite; }
.b-walk .wc-leg-bn { animation: wc-stride 0.44s ease-in-out infinite; }
.b-walk .wc-leg-fn { animation: wc-stride 0.44s ease-in-out infinite; animation-delay: -0.22s; }
.b-walk .wc-leg-bf { animation: wc-stride 0.44s ease-in-out infinite; animation-delay: -0.22s; }
.b-walk .wc-leg-ff { animation: wc-stride 0.44s ease-in-out infinite; }
.b-walk .wc-tail { animation: wc-wag 0.66s ease-in-out infinite; }
.b-walk .wc-ear { animation: wc-earbob 0.44s ease-in-out infinite; }
@keyframes wc-stride { 0%,100% { transform: rotate(20deg); } 50% { transform: rotate(-20deg); } }
@keyframes wc-bob { 0%,50%,100% { transform: translateY(0); } 25%,75% { transform: translateY(-1.8px); } }
@keyframes wc-wag { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(10deg); } }
@keyframes wc-earbob { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(6deg); } }

/* ---------- IDLE: breathe, blink, lazy tail ---------- */
.b-idle .wc-root { animation: wc-breathe 3.4s ease-in-out infinite; }
.b-idle .wc-tail { animation: wc-wag 2.4s ease-in-out infinite; }
.b-idle .wc-eye, .b-idle .wc-eye-hl { animation: wc-blink 4.2s ease-in-out infinite; }
@keyframes wc-breathe { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.03); } }
@keyframes wc-blink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }

/* ---------- SIT ---------- */
.b-sit .wc-root { transform: translateY(4px); animation: wc-breathe 3.6s ease-in-out infinite; }
.b-sit .wc-leg-bn, .b-sit .wc-leg-bf { transform: rotate(72deg); }
.b-sit .wc-tail { animation: wc-wag 2s ease-in-out infinite; }

/* ---------- SLEEP: lie low, eyes shut, slow breathe ---------- */
.b-sleep .wc-root { transform: translateY(10px) scaleY(0.84); animation: wc-breathe 4.6s ease-in-out infinite; }
.b-sleep .wc-leg-bn, .b-sleep .wc-leg-bf, .b-sleep .wc-leg-fn, .b-sleep .wc-leg-ff { transform: rotate(86deg); }
.b-sleep .wc-eye, .b-sleep .wc-eye-hl { opacity: 0; }
.b-sleep .wc-eye-shut { opacity: 1; }

/* ---------- SNIFF: head down, tail up, little wiggle ---------- */
.b-sniff .wc-head { animation: wc-sniff 0.7s ease-in-out infinite; }
.b-sniff .wc-tail { transform: rotate(28deg); }
@keyframes wc-sniff { 0%,100% { transform: rotate(14deg) translateY(4px); } 50% { transform: rotate(18deg) translateY(7px); } }

/* ---------- HAPPY: hop + fast wag + perked ear ---------- */
.b-happy .wc-root { animation: wc-hop 0.4s ease-in-out infinite; }
.b-happy .wc-tail { animation: wc-wag 0.24s ease-in-out infinite; }
.b-happy .wc-ear { animation: wc-earbob 0.3s ease-in-out infinite; }
@keyframes wc-hop { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-7px); } 60% { transform: translateY(-7px); } }

@media (prefers-reduced-motion: reduce) {
  .wc-root, .wc-leg, .wc-tail, .wc-ear, .wc-head, .wc-eye, .wc-eye-hl { animation: none !important; }
}
</style>
